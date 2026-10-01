import { expect, test } from "@playwright/test";
import { expectHealthy, login } from "./helpers";

const stamp = Date.now().toString().slice(-6);

test("admin adds a member, duplicate is detected, and the profile shows", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/members/new");
  await page.locator("#first_name").fill("Testa");
  await page.locator("#last_name").fill(`Member${stamp}`);
  await page.locator("#phone").fill(`0809${stamp}1`);
  await page.getByRole("button", { name: "Add member" }).click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText("Member added successfully.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Testa Member${stamp}` })).toBeVisible();

  // Same phone again → duplicate warning
  await page.goto("/members/new");
  await page.locator("#first_name").fill("Other");
  await page.locator("#last_name").fill("Person");
  await page.locator("#phone").fill(`+2349${stamp}1`.replace("+2349", "+234809"));
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Possible duplicate")).toBeVisible();
});

test("attendance worker checks someone in once; duplicates are prevented", async ({ page }) => {
  // Make sure a service exists today (admin schedules one if needed).
  await login(page, "admin");
  await page.goto("/attendance");
  if ((await page.getByRole("link", { name: /Start check-in/ }).count()) === 0) {
    await page.goto("/services?new=1");
    await page.locator("#name").fill("E2E Special Service");
    await page.getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByText("Service scheduled")).toBeVisible();
  }
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "attendance");
  await page.goto("/attendance");
  await page.getByRole("link", { name: /Start check-in/ }).first().click();
  await page.getByLabel("Search people to check in").fill("Testa");
  const btn = page.getByRole("button", { name: /Check in Testa/ }).first();
  await btn.click();
  await expect(page.getByText(/checked in/).first()).toBeVisible();
  await page.getByLabel("Search people to check in").fill("Testa");
  await expect(page.getByRole("button", { name: /Check in Testa/ })).toHaveCount(0);
  await expect(page.getByText("Present").first()).toBeVisible();
});

test("visitor registration works on a phone, then conversion keeps history @mobile", async ({ page, isMobile }) => {
  await login(page, "admin");
  await page.goto("/visitors/new");
  await page.locator("#first_name").fill("Vee");
  await page.locator("#last_name").fill(`Visitor${stamp}${isMobile ? "m" : "d"}`);
  await page.locator("#phone").fill(`0701${stamp}${isMobile ? "2" : "3"}`);
  await page.getByRole("button", { name: "Register visitor" }).click();
  await expect(page.getByText(/has been registered/)).toBeVisible();
  await page.getByRole("link", { name: "View visitor" }).click();
  await page.getByRole("button", { name: "Convert to member" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Convert to member" }).click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText("converted from visitor")).toBeVisible();
});

test("finance records and voids a contribution", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/giving/new");
  await page.locator("#amount").fill("12,500");
  await page.getByLabel("Anonymous gift").click();
  await page.getByRole("button", { name: "Record contribution" }).click();
  await page.waitForURL("**/giving");
  await expect(page.getByText("Contribution recorded")).toBeVisible();
  await page.getByRole("link").filter({ hasText: /\d{4}/ }).first().click();
  await page.getByRole("button", { name: "Void" }).click();
  await page.getByLabel(/Reason/).fill("Duplicate entry test");
  await page.getByRole("button", { name: "Void contribution" }).click();
  await expect(page.getByText(/voided/i).first()).toBeVisible();
});

test("follow-up worker records a follow-up from their list", async ({ page }) => {
  await login(page, "followup");
  await page.goto("/followups?view=mine");
  await expectHealthy(page);
  const record = page.getByRole("button", { name: "Record follow-up" }).first();
  await record.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("WhatsApp", { exact: true }).click();
  await dialog.locator("select[name=outcome]").selectOption("reached");
  await dialog.locator("textarea[name=notes]").fill("Spoke with them, will attend Sunday.");
  await dialog.getByRole("button", { name: "Save follow-up" }).click();
  await expect(page.getByText(/Follow-up recorded/)).toBeVisible();
});

test("global search finds members and respects permissions", async ({ page }) => {
  await login(page, "admin");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search members, visitors/).fill("Testa");
  await expect(page.getByRole("option", { name: /Testa Member/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await login(page, "finance");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search members, visitors/).fill("Testa");
  await expect(page.getByText("No results found.")).toBeVisible();
});

test("a user from another church cannot open this church's records", async ({ page }) => {
  // Collect a member URL from the demo church.
  await login(page, "admin");
  await page.goto("/members");
  const hrefs = await page.locator('a[href^="/members/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const href = hrefs.find((h) => /^\/members\/[0-9a-f-]{36}$/.test(h));
  expect(href).toMatch(/\/members\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  // Register a brand-new church (local stack auto-confirms emails).
  await page.goto("/register");
  await page.locator("#full_name").fill("Other Admin");
  await page.locator("#email").fill(`other${stamp}@test.local`);
  await page.locator("#password").fill("Password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.locator("#name").fill(`Other Church ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create church" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto(href!);
  await expect(page.getByText("Not found")).toBeVisible();
  await page.goto("/members");
  await expect(page.getByText("No members yet")).toBeVisible();
  const res = await page.request.get("/api/export/members");
  const csv = await res.text();
  expect(csv).not.toContain("Testa");
});
