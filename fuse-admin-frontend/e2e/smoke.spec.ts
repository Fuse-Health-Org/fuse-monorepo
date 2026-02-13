import { createSmokeTests, type SmokeTestPage } from "@fuse/e2e";

const pages: SmokeTestPage[] = [
  // ── Public pages ──────────────────────────────────────────
  { path: "/signin", name: "Sign In" },
  { path: "/signup", name: "Sign Up" },
  { path: "/verify-email", name: "Verify Email" },
  { path: "/terms", name: "Terms" },
  { path: "/privacy", name: "Privacy" },
  { path: "/privacy-notice", name: "Privacy Notice" },
  { path: "/forgot-password", name: "Forgot Password" },

  // ── Protected pages ───────────────────────────────────────
  { path: "/", name: "Dashboard", auth: true },
  { path: "/customers", name: "Customers", auth: true },
  { path: "/contacts", name: "Contacts", auth: true },
  { path: "/orders", name: "Orders", auth: true },
  { path: "/affiliates", name: "Affiliates", auth: true },
  { path: "/payouts", name: "Payouts", auth: true },
  { path: "/settings", name: "Settings", auth: true },
  { path: "/products", name: "Products", auth: true },
  { path: "/products/new", name: "New Product", auth: true },
  { path: "/treatments", name: "Treatments", auth: true },
  { path: "/treatments/new", name: "New Treatment", auth: true },
  { path: "/analytics", name: "Analytics", auth: true },
  { path: "/offerings", name: "Offerings", auth: true },
  { path: "/portal", name: "Portal", auth: true },
  { path: "/programs", name: "Programs", auth: true },
  { path: "/sequences", name: "Sequences", auth: true },
  { path: "/templates", name: "Templates", auth: true },
  { path: "/tags", name: "Tags", auth: true },
  { path: "/plans", name: "Plans", auth: true },
  { path: "/checkout", name: "Checkout", auth: true },
  { path: "/brand-signup", name: "Brand Signup", auth: true },
];

createSmokeTests(pages);
