# PostHog Analytics Integration Plan

## Context

FUSE Health currently has no product analytics platform. There's a custom backend analytics system for form tracking (views/conversions/dropoffs) and Vercel Analytics conditionally enabled in 3 apps, but no tool for understanding user behavior, feature adoption, or funnel analysis across portals. PostHog will fill this gap as a centralized analytics platform across all 5 frontend apps, with the tenant portal (super admin) being opt-in via env var.

## Approach

Create a shared `@fuse/posthog` package following the existing `@fuse/stripe` pattern, then integrate it into each frontend app's `_app.tsx` and `AuthContext.tsx`.

---

## Step 1: Add `posthog-js` to pnpm workspace catalog

**File:** [pnpm-workspace.yaml](pnpm-workspace.yaml)

Add under the `# Analytics` section (after `@vercel/analytics`):
```yaml
posthog-js: ^1.236.0
```

---

## Step 2: Create `@fuse/posthog` shared package

### `packages/posthog/package.json`
```json
{
  "name": "@fuse/posthog",
  "private": true,
  "version": "1.0.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "type:check": "tsc --noEmit",
    "clean": "git clean -xdf .cache .turbo node_modules"
  },
  "dependencies": {
    "posthog-js": "catalog:"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "next": "^14.0.0"
  },
  "devDependencies": {
    "@fuse/tsconfig": "workspace:*",
    "@types/react": "catalog:react18",
    "next": "catalog:next14",
    "react": "catalog:react18",
    "typescript": "catalog:"
  }
}
```

### `packages/posthog/tsconfig.json`
Extends base config, adds `"jsx": "react-jsx"` for the provider component.

### `packages/posthog/index.ts`
Re-exports from `./src/index`.

### `packages/posthog/src/types.ts`
```typescript
export interface PostHogConfig {
  apiKey: string;
  host?: string;
  enabled?: boolean;
}

export interface IdentifyUserParams {
  userId: string;
  role: string;
  clinicId?: string;
  // HIPAA: NO email, name, dob, address, phone
}
```

### `packages/posthog/src/provider.tsx`

- **Guard: no-ops when `apiKey` is empty OR `enabled` is false** — renders children only (transparent wrapper). This is what makes local dev automatically silent.
- Initializes `posthog-js` in a `useEffect` (client-side only)
- Uses `useRef` to prevent double-init in React 18 strict mode
- HIPAA-safe defaults: `session_recording: { maskAllInputs: true }`
- `capture_pageview: false` — manually captures `$pageview` on Next.js `routeChangeComplete` events (Pages Router SPA navigation)
- Captures initial pageview on mount
- Wraps children in `PostHogProvider` from `posthog-js/react` when active

### `packages/posthog/src/hooks.ts`

- **`useIdentifyUser(params | null)`**: Calls `posthog.identify(userId, { role, clinicId })` when params provided, `posthog.reset()` when `null` (logout)
- Re-exports `usePostHog` from `posthog-js/react`

### `packages/posthog/src/index.ts`
Exports: `PostHogAnalyticsProvider`, `usePostHog`, `useIdentifyUser`, types.

---

## Step 3: Integrate into each frontend app

For each app, 3 changes: (A) add dependency, (B) wrap `_app.tsx`, (C) add identify/reset in auth context.

### 3a. patient-frontend

**[patient-frontend/package.json](patient-frontend/package.json)** — Add `"@fuse/posthog": "workspace:*"`

**[patient-frontend/pages/_app.tsx](patient-frontend/pages/_app.tsx)** — Wrap inside `AuthProvider`:
```
HeroUIProvider > ToastProvider > AuthProvider > PostHogAnalyticsProvider > ProtectedRouteProvider > ...
```
Config: `enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false'` (ON by default)

> Provider goes **inside** AuthProvider so `useAuth` is available for identify, but the PostHog init itself doesn't depend on auth.

**[patient-frontend/contexts/AuthContext.tsx](patient-frontend/contexts/AuthContext.tsx)** — Add `useIdentifyUser` hook in `AuthProvider` body, and `posthog.reset()` in `handleSignOut` (line 96).

### 3b. fuse-admin-frontend

**[fuse-admin-frontend/package.json](fuse-admin-frontend/package.json)** — Add dependency

**[fuse-admin-frontend/pages/_app.tsx](fuse-admin-frontend/pages/_app.tsx)** — Wrap inside `AuthProvider`:
```
ThemeProvider > AuthProvider > PostHogAnalyticsProvider > {content} + ToastManager
```
Config: `enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false'` (ON by default)

**[fuse-admin-frontend/contexts/AuthContext.tsx](fuse-admin-frontend/contexts/AuthContext.tsx)** — Add `useIdentifyUser` hook. Add `posthog.reset()` in `logout` (line 105) and `handleUnauthorized` (line 89).

### 3c. fuse-tenant-portal-frontend (optional)

**[fuse-tenant-portal-frontend/package.json](fuse-tenant-portal-frontend/package.json)** — Add dependency

**[fuse-tenant-portal-frontend/pages/_app.tsx](fuse-tenant-portal-frontend/pages/_app.tsx)** — Wrap inside `AuthProvider`:
```
ThemeProvider > AuthProvider > TenantProvider > PostHogAnalyticsProvider > {content}
```
Config: **`enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'`** (OFF by default — this is the key difference)

**[fuse-tenant-portal-frontend/contexts/AuthContext.tsx](fuse-tenant-portal-frontend/contexts/AuthContext.tsx)** — Add `useIdentifyUser` + `posthog.reset()` in logout/handleUnauthorized.

### 3d. fuse-doctor-portal-frontend

**[fuse-doctor-portal-frontend/package.json](fuse-doctor-portal-frontend/package.json)** — Add dependency

**[fuse-doctor-portal-frontend/pages/_app.tsx](fuse-doctor-portal-frontend/pages/_app.tsx)** — Wrap inside `AuthProvider`:
```
ThemeProvider > AuthProvider > WebSocketProvider > PostHogAnalyticsProvider > {content}
```
Config: `enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false'` (ON by default)

**[fuse-doctor-portal-frontend/contexts/AuthContext.tsx](fuse-doctor-portal-frontend/contexts/AuthContext.tsx)** — Add identify/reset.

### 3e. fuse-affiliate-portal-frontend

**[fuse-affiliate-portal-frontend/package.json](fuse-affiliate-portal-frontend/package.json)** — Add dependency

**[fuse-affiliate-portal-frontend/pages/_app.tsx](fuse-affiliate-portal-frontend/pages/_app.tsx)** — Wrap inside `AuthProvider`:
```
ThemeProvider > HeroUIProvider > ToastProvider > AuthProvider > PostHogAnalyticsProvider > Component
```
Config: `enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false'` (ON by default)

**[fuse-affiliate-portal-frontend/contexts/AuthContext.tsx](fuse-affiliate-portal-frontend/contexts/AuthContext.tsx)** — Add identify/reset.

---

## Step 4: Environment variables & environment strategy

### How environments are handled

The provider has a **two-layer guard**: it only initializes when both `apiKey` is present AND `enabled` is true. This gives automatic environment separation without any code changes per environment:

| Environment | `NEXT_PUBLIC_POSTHOG_KEY` | Result | Notes |
|---|---|---|---|
| **Local dev** | Not set (empty) | No tracking | Zero events sent — safe for local development |
| **Staging** | Set to staging project key | Tracks to staging project | Use a separate PostHog project to keep data clean |
| **Production** | Set to production project key | Tracks to production project | Real analytics data |

**Tenant portal** has an additional guard: even with a key present, it requires `NEXT_PUBLIC_POSTHOG_ENABLED=true` to activate.

### Recommended PostHog project setup
- Create **2 PostHog projects**: "FUSE Health - Staging" and "FUSE Health - Production"
- Each project has its own API key (`phc_...`)
- Set the corresponding key in each environment's `.env.local`
- Local dev: simply don't add the key to your `.env.local`

### `.env.example` additions

**[.env.example](.env.example)** — Add:
```
# PostHog Analytics
# Get your project API key from https://app.posthog.com/project/settings
# Leave unset in local development to disable tracking
NEXT_PUBLIC_POSTHOG_KEY=
# PostHog host (optional, defaults to https://us.i.posthog.com)
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# Explicit enable flag (only needed for tenant portal which defaults to OFF)
# NEXT_PUBLIC_POSTHOG_ENABLED=true
```

### `.env.local` per environment

**Local dev** — Don't add the key (or leave empty):
```
# NEXT_PUBLIC_POSTHOG_KEY=   ← not set, no tracking
```

**Staging server** `.env.local`:
```
NEXT_PUBLIC_POSTHOG_KEY=phc_staging_project_key_here
```

**Production server** `.env.local`:
```
NEXT_PUBLIC_POSTHOG_KEY=phc_production_project_key_here
```

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `pnpm-workspace.yaml` | Add `posthog-js` to catalog |
| 2 | `packages/posthog/package.json` | **NEW** |
| 3 | `packages/posthog/tsconfig.json` | **NEW** |
| 4 | `packages/posthog/index.ts` | **NEW** |
| 5 | `packages/posthog/src/index.ts` | **NEW** |
| 6 | `packages/posthog/src/types.ts` | **NEW** |
| 7 | `packages/posthog/src/provider.tsx` | **NEW** |
| 8 | `packages/posthog/src/hooks.ts` | **NEW** |
| 9-13 | `*/package.json` (5 apps) | Add `@fuse/posthog` dependency |
| 14-18 | `*/pages/_app.tsx` (5 apps) | Wrap with `PostHogAnalyticsProvider` |
| 19-23 | `*/contexts/AuthContext.tsx` (5 apps) | Add identify/reset |
| 24 | `.env.example` | Add PostHog env vars |

---

## Verification

1. `pnpm install` — resolves workspace package
2. `pnpm --filter @fuse/posthog type:check` — type check the package
3. `pnpm build` — full monorepo build
4. Start any frontend app, open DevTools Network tab, filter for `posthog` — verify `$pageview` fires on load and navigation
5. Log in — verify `identify` call with `userId`, `role`, `clinicId` (no email/name/PHI)
6. Log out — verify `posthog.reset()` fires
7. For tenant portal: confirm no PostHog requests when `NEXT_PUBLIC_POSTHOG_ENABLED` is unset, and requests appear when set to `'true'`
