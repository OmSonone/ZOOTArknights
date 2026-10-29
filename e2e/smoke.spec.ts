import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("loads the roster page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible({ timeout: 15_000 });
  });

  test("navigates between pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible({ timeout: 15_000 });

    // Navigate to Planner
    await page.click('a[href="/planner"]');
    await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();

    // Navigate to Collection
    await page.click('a[href="/collection"]');
    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();

    // Navigate to Input
    await page.click('a[href="/input"]');
    await expect(page.getByRole("heading", { name: "Input" })).toBeVisible();

    // Navigate to Profile
    await page.click('a[href="/profile"]');
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });
});

test.describe("Roster page", () => {
  test("renders operator cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible({ timeout: 15_000 });
    const cards = page.locator(".op-card");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(400);
  });

  test("search filters operators", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".op-card").first()).toBeVisible({ timeout: 15_000 });

    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("SilverAsh");
      await page.waitForTimeout(300);
      const cards = page.locator(".op-card");
      const count = await cards.count();
      expect(count).toBeLessThan(10);
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe("Planner page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Themes", () => {
  test("can toggle between light and dark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible({ timeout: 15_000 });

    const themeButton = page.getByRole("button", { name: /mode/i });
    if (await themeButton.isVisible()) {
      const initialText = await themeButton.textContent();
      await themeButton.click();
      const newText = await themeButton.textContent();
      expect(newText).not.toBe(initialText);
    }
  });
});

test.describe("Responsive", () => {
  test("no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await expect(page.locator(".op-card").first()).toBeVisible({ timeout: 15_000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("no horizontal overflow at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".op-card").first()).toBeVisible({ timeout: 15_000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("Export / Import save", () => {
  test("export button is available", async ({ page }) => {
    await page.goto("/input");
    await expect(page.getByRole("heading", { name: "Input" })).toBeVisible({ timeout: 15_000 });

    const exportButton = page.getByRole("button", { name: /export/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });
});
