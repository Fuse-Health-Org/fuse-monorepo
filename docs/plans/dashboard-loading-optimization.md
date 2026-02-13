# Plan: Dashboard Loading Time Optimization

**Status:** Active
**Related PRD:** N/A (Performance improvement)
**Branch:** `imp2`
**Created:** 2026-02-13
**Last Updated:** 2026-02-13

## Overview

The admin portal dashboard (`/`) is slow to become interactive due to zero code splitting, duplicate API calls, and heavy components loading synchronously. This plan targets a 40-60% reduction in Time to Interactive (TTI) through 4 incremental phases.

**Root causes identified:**
- Zero `next/dynamic` usage — all components (including Recharts ~350KB) in initial bundle
- `/brand-subscriptions/basic-info` fetched by both Sidebar and Dashboard (duplicate)
- Tutorial component (763 lines) loads on every page even when tutorial is finished
- 4-6 parallel API calls fire client-side on mount before anything renders
- Sidebar refetches subscription data on every route change
- Excessive `console.log` calls in hot paths (~66 total across sidebar, tutorial, auth)

## Phases

### Phase 1: Quick Wins (< 30 min total)

- [x] **1.1** Remove duplicate `/brand-subscriptions/basic-info` API call from Dashboard
  - File: `fuse-admin-frontend/pages/index.tsx`
  - Used existing `hasActiveSubscription` from AuthContext instead of fetching again
  - Impact: -1 API call per dashboard load

- [x] **1.2** Add staleness check to Sidebar's subscription fetch
  - File: `fuse-admin-frontend/components/sidebar.tsx`
  - Added 5-min TTL via `useRef` to skip redundant refetches on route change
  - Impact: -1 API call per page navigation

### Phase 2: Code Splitting with `next/dynamic` (1-2 hours)

- [ ] **2.1** Lazy-load `StoreAnalytics` (Recharts) — **HIGHEST IMPACT**
  - File: `fuse-admin-frontend/pages/index.tsx` (line 5)
  - Use `next/dynamic` with `ssr: false` and skeleton loading state
  - Recharts is ~350KB+; chart is below the fold
  - Impact: Largest single bundle size reduction

- [ ] **2.2** Lazy-load `Tutorial` conditionally in Sidebar
  - File: `fuse-admin-frontend/components/sidebar.tsx` (~line 27, ~line 394)
  - Dynamic import + conditional render only when `runTutorial` is true
  - Currently mounts even when inactive, running 500ms polling + event listeners
  - Impact: Eliminates 763 lines of JS for ~95% of page loads

- [ ] **2.3** Lazy-load `RecentOrders` below the fold
  - File: `fuse-admin-frontend/pages/index.tsx` (line 6)
  - Same `next/dynamic` pattern with skeleton placeholder
  - Impact: Moderate — defers parsing + API call

### Phase 3: Reduce API Waterfall (2-4 hours)

- [ ] **3.1** Create shared `useSubscriptionBasicInfo` hook with request deduplication
  - New file: `fuse-admin-frontend/hooks/useSubscriptionBasicInfo.ts`
  - Modify: `sidebar.tsx`, `pages/index.tsx`
  - Module-level in-flight promise deduplication + 60-second cache
  - Impact: Single source of truth, eliminates duplicate fetches

- [ ] **3.2** Cache `/organization` response in sessionStorage
  - File: `fuse-admin-frontend/components/sidebar.tsx` (~line 171)
  - Clinic name/logo rarely changes; 10-min TTL, clear on Settings save
  - Impact: -1 API call on dashboard load for returning sessions

### Phase 4: Combined Backend Endpoint (half day, optional)

- [ ] **4.1** Create `GET /dashboard/overview` endpoint
  - Backend: `patient-api/src/endpoints/dashboard/controllers/dashboard.controller.ts`
  - Backend: `patient-api/src/endpoints/dashboard/routes/dashboard.routes.ts`
  - Combines metrics + revenue chart + recent orders via `Promise.all`
  - One auth check instead of 4
  - Impact: 4 API calls → 1

- [ ] **4.2** Create `useDashboardData` hook on frontend
  - File: `fuse-admin-frontend/pages/index.tsx`
  - Single fetch, pass data as props to MetricCards, StoreAnalytics, RecentOrders
  - Keep per-component fetch as fallback when components used outside dashboard

## Architecture Decisions

- **Decision:** Use `next/dynamic` instead of `React.lazy`
  - **Context:** Need code splitting for below-fold dashboard components
  - **Alternatives considered:** React.lazy + Suspense, manual webpack chunks
  - **Rationale:** `next/dynamic` is the idiomatic Next.js solution, supports SSR opt-out and loading states natively

- **Decision:** Use `hasActiveSubscription` from AuthContext instead of separate API call
  - **Context:** Dashboard duplicates subscription status check that AuthContext already performs
  - **Alternatives considered:** Shared hook (Phase 3), keeping both calls
  - **Rationale:** AuthContext already fetches and exposes this value; no new code needed

- **Decision:** sessionStorage for org info cache (not React state/context)
  - **Context:** Sidebar fetches clinic name/logo on every mount
  - **Alternatives considered:** React context, localStorage, SWR/React Query
  - **Rationale:** sessionStorage survives page navigations but clears on tab close; no dependency additions needed

## Verification

1. Run `ANALYZE=true pnpm --filter @fuse/admin-frontend build` before/after to compare bundle sizes
2. Build output shows per-page JS sizes — compare the `/` page before/after
3. Manual test: sign in → dashboard loads, verify MetricCards, StoreAnalytics, RecentOrders all render
4. Verify checkout gate modal still appears for users without active subscription
5. Verify tutorial still works for new users (first-time onboarding flow)
6. Check browser DevTools Network tab — confirm reduced API calls
7. Run Lighthouse on `localhost:3002` — compare FCP, LCP, TTI, TBT

## Notes & Learnings

- Each phase can be shipped as its own PR
- Phase 1 + Phase 2 deliver ~80% of the improvement with minimal risk
- Phase 4 (combined endpoint) requires coordinated frontend + backend changes
