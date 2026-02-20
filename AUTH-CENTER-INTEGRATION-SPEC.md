# Auth Center Integration Spec — Retention Center

## Current State (2026-02-20)

**Retention Center is NOT integrated with Auth Center.** It runs as a standalone app with no auth layer.

## What This Project Needs

See the full spec at `/Users/sky/meta-media-buying/AUTH-CENTER-INTEGRATION-SPEC.md`.

Summary of changes needed:
1. `npm install jose`
2. Create `src/middleware.ts` — verify `rc_access` JWT cookie, redirect to Auth Center if missing
3. Add env vars: `JWT_SECRET`, `AUTH_CENTER_URL`, `PROJECT_ID=retention-center`
4. Add `/api/auth/callback` route — receive tokens from Auth Center, set cookie
5. Add `/api/auth/logout` route — clear cookie, redirect to Auth Center logout
6. Add client-side logout detection (periodic check or BroadcastChannel)
7. Add user display + logout button to sidebar

Cookie name: `rc_access` on `ag2.q37fh758g.click`
