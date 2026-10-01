import { expect, type Page } from "@playwright/test";

export const DOMAIN = process.env.SEED_EMAIL_DOMAIN ?? "demo.churchx.app";
export const PASSWORD = process.env.SEED_PASSWORD ?? "ChurchX-demo-2026";

export async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.locator("#email").fill(`${role}@${DOMAIN}`);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

/** Fails if the page rendered an error boundary or a load failure. */
export async function expectHealthy(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByText(/Couldn't load/)).toHaveCount(0);
}
