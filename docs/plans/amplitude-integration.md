# Plan: Add Amplitude Analytics to Frontend Apps

## Context

FUSE Health has no third-party client-side analytics. There's only Vercel web vitals in some portals and custom server-side form analytics in patient-frontend. Adding Amplitude will provide user behavior tracking (page views, feature usage, funnels) across all 5 frontend apps with a single shared API key.

## Approach

Create a shared `@fuse/amplitude` package (following the same conventions as `@fuse/stripe`, `@fuse/enums`, `@fuse/validators`) with an Amplitude-backed `AmplitudeProvider` and `useAmplitude` hook, then integrate it into each frontend app's `_app.tsx`.

---

## Step 1: Create `packages/amplitude/` shared package

### Files to create

**`packages/amplitude/package.json`** (matches `@fuse/validators` structure)
```json
{
  "name": "@fuse/amplitude",
  "private": true,
  "version": "1.0.0",
  "description": "Shared Amplitude analytics for Fuse Health frontend apps",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "echo \"Error: no test specified\" && exit 1",
    "type:check": "tsc --noEmit",
    "clean": "git clean -xdf .cache .turbo dist node_modules"
  },
  "dependencies": {
    "@amplitude/analytics-browser": "catalog:",
    "@fuse/tsconfig": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "next": "^14.0.0"
  },
  "devDependencies": {
    "@types/react": "catalog:react18",
    "dotenv": "catalog:",
    "typescript": "catalog:"
  }
}
```

**`packages/amplitude/tsconfig.json`** (matches `@fuse/stripe` tsconfig + jsx)
```json
{
  "extends": "@fuse/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "resolveJsonModule": true,
    "noEmit": false,
    "module": "CommonJS",
    "moduleResolution": "node",
    "emitDeclarationOnly": false,
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "index.ts"],
  "exclude": ["dist", "node_modules"]
}
```

**`packages/amplitude/index.ts`**
```ts
export * from "./src/index";
```

**`packages/amplitude/src/types.ts`** — Event name enum + type definitions
- `AmplitudeEvent` enum with standardized event names (PAGE_VIEW, LOGIN, LOGOUT, ORDER_STARTED, ORDER_COMPLETED, FORM_STARTED, FORM_SUBMITTED, BUTTON_CLICKED, etc.)
- `AmplitudeUserProperties` interface — HIPAA-safe: only `role`, `clinicId`, `appName` (no names, emails, DOB)
- `AmplitudeConfig` interface — `apiKey`, `appName`, `debug?`

**`packages/amplitude/src/tracker.ts`** — Core tracking functions (non-React)
- `initAmplitude(config)` — Calls `amplitude.init()`. If `apiKey` is empty, silently returns (this is how tenant portal opt-out works). Disables Amplitude's auto page tracking (we handle it via Next.js router events).
- `shutdownAmplitude()` — Flushes and resets
- `identifyUser(userId, userProperties)` — Sets Amplitude user ID + properties
- `resetUser()` — Calls `amplitude.reset()` on logout
- `trackEvent(eventName, options?)` — Tracks with `app_name` auto-appended
- `sanitizeUrl(url)` — Internal helper that strips PHI-related query params (email, name, patientId, dob, phone, address) before tracking
- `trackPageView(url)` — Tracks `Page Viewed` with sanitized `page_path`

**`packages/amplitude/src/provider.tsx`** — React provider component
- `AmplitudeProvider` accepts `config`, `user`, `children` props
- `user` prop is `{ id: string; role: string; clinicId?: string } | null` — decoupled from any app's AuthContext
- On mount: calls `initAmplitude(config)`
- On user change: calls `identifyUser` or `resetUser`
- On route change: listens to `router.events.routeChangeComplete` for auto page views
- On unmount: calls `shutdownAmplitude()`

**`packages/amplitude/src/hooks.ts`** — React hook
- `useAmplitude()` returns `{ track }` — a stable `useCallback` wrapper around `trackEvent`
- Accepts `AmplitudeEvent` enum (type-safe) or raw strings

**`packages/amplitude/src/index.ts`** — Barrel export of all public API

---

## Step 2: Add Amplitude SDK to pnpm catalog

**File: `pnpm-workspace.yaml`** — Add to `catalog:` section:
```yaml
"@amplitude/analytics-browser": ^2.11.0
```

Also add `@types/react` to the `react18` catalog if not already present.

---

## Step 3: Integrate into each frontend app

For each app, two changes:
1. Add `"@fuse/amplitude": "workspace:*"` to `package.json` dependencies
2. Add `AmplitudeWrapper` component + `AmplitudeProvider` to `_app.tsx`

The `AmplitudeWrapper` pattern (same in every app, only `appName` and user field mapping differ):

```tsx
import { AmplitudeProvider } from '@fuse/amplitude';

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <AmplitudeProvider
      config={{
        apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
        appName: '<app-name>',
        debug: process.env.NODE_ENV === 'development',
      }}
      user={user ? { id: user.id, role: user.role, clinicId: user.clinicId } : null}
    >
      {children}
    </AmplitudeProvider>
  );
}
```

Placed **inside** `AuthProvider` (so `useAuth()` works) and **around** the rest of the content.

### Per-app integration details

| App | File | `appName` | Placement | Notes |
|-----|------|-----------|-----------|-------|
| patient-frontend | `patient-frontend/pages/_app.tsx` | `patient` | Inside `<AuthProvider>`, wrapping `<ProtectedRouteProvider>` | Existing form analytics untouched |
| fuse-admin-frontend | `fuse-admin-frontend/pages/_app.tsx` | `admin` | Inside `<AuthProvider>`, wrapping `{content}` + `<ToastManager>` | — |
| fuse-doctor-portal-frontend | `fuse-doctor-portal-frontend/pages/_app.tsx` | `doctor` | Inside `<AuthProvider>`, wrapping content | No `clinicId` on doctor user |
| fuse-affiliate-portal-frontend | `fuse-affiliate-portal-frontend/pages/_app.tsx` | `affiliate` | Inside `<AuthProvider>`, wrapping `<Component>` | No `clinicId` on affiliate user |
| fuse-tenant-portal-frontend | `fuse-tenant-portal-frontend/pages/_app.tsx` | `tenant` | Inside `<AuthProvider>`, wrapping content | — |

---

## Step 4: Environment variables

**File: `.env.example`** — Add:
```
NEXT_PUBLIC_AMPLITUDE_API_KEY=      # Amplitude API key (leave empty to disable analytics)
```

One key shared across all 5 apps. All apps get Amplitude integration.

---

## Key Design Decisions

1. **Follows existing package conventions** — `dist/` compiled output with `tsc` build, CommonJS module, same tsconfig/package.json structure as `@fuse/stripe`
2. **Provider accepts `user` prop** (not calling `useAuth()` internally) — keeps the package decoupled from each app's AuthContext shape
3. **No-op when API key is empty** — no errors, no console warnings in prod; graceful degradation
4. **HIPAA compliant** — only sends user UUID, role, clinicId (all opaque). No PII (names, email, DOB, addresses). URL sanitization strips PHI from page view tracking
5. **Manual page view tracking** — Amplitude's auto page tracking doesn't work well with Next.js client-side routing. We use `router.events.routeChangeComplete` instead
6. **Existing analytics untouched** — patient-frontend's custom form analytics (`lib/analytics.ts`) and Vercel Analytics coexist with Amplitude

## HIPAA Compliance Safeguards

Amplitude analytics is HIPAA-compatible with the following safeguards in place:

### BAA Requirement
If using **Amplitude Cloud**, a signed **Business Associate Agreement (BAA)** is required (available on Growth/Enterprise plans). Contact Amplitude sales to execute the BAA before sending any production data.

### Data Protection

The `@fuse/amplitude` package enforces these protections:

1. **PHI-free identify calls** — `identifyUser()` only sends `userId` (UUID), `role`, `clinicId`, and `app_name`. Never email, name, DOB, address, or phone.
2. **URL sanitization** — `trackPageView()` runs all URLs through `sanitizeUrl()` which strips query parameters: `email`, `name`, `patientId`, `dob`, `phone`, `address` before sending to Amplitude.
3. **Autocapture disabled** — `autocapture: false` prevents Amplitude from automatically capturing DOM elements, form values, or text content.
4. **No session replay** — Amplitude Session Replay is not enabled. If enabled in the future, it **must** be configured with text and input masking equivalent to PostHog's `maskTextContent: true` / `maskAllInputs: true`.

### Risk Assessment by App

| App | Risk Level | Notes |
|-----|-----------|-------|
| patient-frontend | Medium | URL sanitization protects against PHI in routes. No DOM capture. |
| admin-frontend | Medium | May have patient data in URL params. Sanitized. |
| doctor-portal | Medium | Clinical data in URL params possible. Sanitized. |
| tenant-portal | Low | System-level configuration, no patient data in URLs. |
| affiliate-portal | Low | Aggregate referral data only. |

### HIPAA Compliance Checklist

- [x] No PHI in `identify()` calls (userId, role, clinicId only)
- [x] Autocapture disabled (no DOM/text/input capture)
- [x] URL sanitization strips PHI-related query parameters from page views
- [x] No session replay enabled
- [ ] BAA signed with Amplitude (required if using Amplitude Cloud)
- [ ] Document Amplitude usage in HIPAA compliance records

---

## Files Modified

| File | Action |
|------|--------|
| `packages/amplitude/package.json` | Create |
| `packages/amplitude/tsconfig.json` | Create |
| `packages/amplitude/index.ts` | Create |
| `packages/amplitude/src/index.ts` | Create |
| `packages/amplitude/src/types.ts` | Create |
| `packages/amplitude/src/tracker.ts` | Create |
| `packages/amplitude/src/provider.tsx` | Create |
| `packages/amplitude/src/hooks.ts` | Create |
| `pnpm-workspace.yaml` | Edit — add `@amplitude/analytics-browser` to catalog |
| `patient-frontend/package.json` | Edit — add `@fuse/amplitude` dep |
| `patient-frontend/pages/_app.tsx` | Edit — add AmplitudeWrapper |
| `fuse-admin-frontend/package.json` | Edit — add `@fuse/amplitude` dep |
| `fuse-admin-frontend/pages/_app.tsx` | Edit — add AmplitudeWrapper |
| `fuse-doctor-portal-frontend/package.json` | Edit — add `@fuse/amplitude` dep |
| `fuse-doctor-portal-frontend/pages/_app.tsx` | Edit — add AmplitudeWrapper |
| `fuse-affiliate-portal-frontend/package.json` | Edit — add `@fuse/amplitude` dep |
| `fuse-affiliate-portal-frontend/pages/_app.tsx` | Edit — add AmplitudeWrapper |
| `fuse-tenant-portal-frontend/package.json` | Edit — add `@fuse/amplitude` dep |
| `fuse-tenant-portal-frontend/pages/_app.tsx` | Edit — add AmplitudeWrapper |
| `.env.example` | Edit — add `NEXT_PUBLIC_AMPLITUDE_API_KEY` |

## Verification

1. `pnpm install` — no workspace resolution errors
2. `pnpm --filter @fuse/amplitude build` — compiles to `dist/` successfully
3. `pnpm --filter @fuse/amplitude type:check` — types valid
4. `pnpm build` — all apps build successfully
5. Start any frontend — no runtime errors
6. With `debug: true` and API key set — Amplitude init log visible in console
7. Navigate between pages — `Page Viewed` events logged
8. Without `NEXT_PUBLIC_AMPLITUDE_API_KEY` — silent no-op, no errors
