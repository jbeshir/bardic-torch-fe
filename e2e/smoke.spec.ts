import { test, expect } from "@playwright/test";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

test("home page renders without leaving the local machine", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  await page.route("**/*", route => {
    const { hostname } = new URL(route.request().url());
    if (LOCAL_HOSTS.has(hostname)) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bardic Torch" })
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("login redirects to Auth0 without contacting it first", async ({
  request,
}) => {
  const response = await request.get("/auth/login", { maxRedirects: 0 });

  expect(response.status()).toBe(302);
  const location = new URL(response.headers()["location"] ?? "");
  expect(location.origin).toBe("https://auth0.invalid");
  expect(location.pathname).toBe("/authorize");
});
