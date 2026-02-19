import { type Page } from "@playwright/test";
import { serviceUrls } from "./config";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  clinicId: string;
  companyName: string;
}

export interface MockSubscription {
  id: string;
  status: string;
  plan: string;
  tier: string;
}

const DEFAULT_MOCK_USER: MockUser = {
  id: "test-user-id",
  email: "admin@test.com",
  name: "Test Admin",
  firstName: "Test",
  lastName: "Admin",
  role: "admin",
  clinicId: "test-clinic-id",
  companyName: "Test Clinic",
};

const DEFAULT_MOCK_SUBSCRIPTION: MockSubscription = {
  id: "test-sub-id",
  status: "active",
  plan: "professional",
  tier: "professional",
};

export interface MockAdminAuthOptions {
  user?: Partial<MockUser>;
  subscription?: Partial<MockSubscription>;
  apiUrl?: string;
}

/**
 * Sets up auth mocking for the admin frontend.
 * - Seeds localStorage with admin_token and admin_user
 * - Intercepts GET /auth/me and GET /subscriptions/current API calls
 *
 * Must be called BEFORE page.goto().
 */
export async function mockAdminAuth(
  page: Page,
  options: MockAdminAuthOptions = {}
) {
  const user = { ...DEFAULT_MOCK_USER, ...options.user };
  const subscription = {
    ...DEFAULT_MOCK_SUBSCRIPTION,
    ...options.subscription,
  };
  const apiUrl = options.apiUrl ?? serviceUrls.api;

  // Seed localStorage before the page loads
  await page.addInitScript(
    ({ token, userJson }) => {
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", userJson);
    },
    { token: "fake-jwt-token-for-e2e", userJson: JSON.stringify(user) }
  );

  // Intercept /auth/me
  await page.route(`${apiUrl}/auth/me`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: user }),
    });
  });

  // Intercept /subscriptions/current
  await page.route(`${apiUrl}/subscriptions/current`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: subscription }),
    });
  });
}
