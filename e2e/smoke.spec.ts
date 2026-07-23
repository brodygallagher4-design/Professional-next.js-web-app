import { test, expect } from "@playwright/test";

// Smoke tests: the critical public surfaces render and the API is healthy. These
// catch a broken build / provider before it reaches users.

test("home page loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toBeVisible();
});

test("marketplace loads", async ({ page }) => {
  const res = await page.goto("/marketplace");
  expect(res?.status()).toBeLessThan(400);
});

test("products API responds", async ({ request }) => {
  const res = await request.get("/api/products");
  // 200 = live data; 503 = database not configured (e.g. CI without secrets).
  // Both mean the route itself works — a 404/500 would be the real failure.
  expect([200, 503]).toContain(res.status());
});

test("cross-origin POST is blocked (CSRF)", async ({ request }) => {
  const res = await request.post("/api/auth/login", {
    headers: { origin: "https://evil.example.com" },
    data: {},
  });
  expect(res.status()).toBe(403);
});
