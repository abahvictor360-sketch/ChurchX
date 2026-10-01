import { expect, test } from "@playwright/test";
import { expectHealthy, login } from "./helpers";

/** Every page each role can reach renders without errors; forbidden pages are blocked server-side. */
const MATRIX: Record<string, { allowed: string[]; denied: string[] }> = {
  admin: {
    allowed: ["/dashboard", "/members", "/members/new", "/visitors", "/visitors/new", "/followups", "/followups?view=overdue", "/care", "/services", "/attendance", "/departments", "/events", "/giving", "/giving/new", "/reports", "/reports/finance", "/notifications", "/settings", "/settings/church", "/settings/users", "/settings/services", "/settings/giving", "/settings/care", "/settings/data", "/settings/audit", "/settings/profile", "/members/import"],
    denied: [],
  },
  pastor: {
    allowed: ["/dashboard", "/members", "/visitors", "/followups", "/care", "/services", "/attendance", "/departments", "/events", "/reports"],
    denied: ["/giving", "/reports/finance", "/settings/users", "/settings/audit", "/members/new"],
  },
  finance: {
    allowed: ["/dashboard", "/giving", "/giving/new", "/reports/finance"],
    denied: ["/members", "/visitors", "/care", "/reports", "/attendance", "/settings/users"],
  },
  followup: {
    allowed: ["/dashboard", "/followups", "/visitors", "/visitors/new", "/departments"],
    denied: ["/members", "/giving", "/care", "/reports", "/settings/users"],
  },
  attendance: {
    allowed: ["/dashboard", "/attendance", "/visitors/new", "/services", "/events"],
    denied: ["/members", "/giving", "/care", "/reports", "/reports/finance", "/settings/audit"],
  },
  leader: {
    allowed: ["/dashboard", "/departments", "/services", "/events"],
    denied: ["/members", "/giving", "/care", "/reports"],
  },
};

for (const [role, { allowed, denied }] of Object.entries(MATRIX)) {
  test(`${role}: allowed pages render and restricted pages are blocked`, async ({ page }) => {
    test.setTimeout(240_000);
    const serverErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });
    await login(page, role);
    for (const path of allowed) {
      await page.goto(path);
      await expect(page, `${role} should reach ${path}`).not.toHaveURL(/no-access/);
      await expectHealthy(page);
    }
    for (const path of denied) {
      await page.goto(path);
      await expect(page, `${role} must not reach ${path}`).toHaveURL(/no-access/);
    }
    expect(serverErrors).toEqual([]);
  });
}

test("department leader only sees their own department", async ({ page }) => {
  await login(page, "leader");
  await page.goto("/departments");
  await expect(page.getByText("Choir", { exact: true })).toBeVisible();
  await expect(page.getByText("Media", { exact: true })).toHaveCount(0);
});

test("finance sees giving on dashboard; attendance worker does not", async ({ page }) => {
  await login(page, "finance");
  await expect(page.getByText("Giving this month")).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await login(page, "attendance");
  await expect(page.getByText("Giving this month")).toHaveCount(0);
  await expect(page.getByText("Total members")).toHaveCount(0);
});
