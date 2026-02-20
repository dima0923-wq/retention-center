# Auth Center Integration Spec — Retention Center

## Overview

Integrate Retention Center (`ag2.q37fh758g.click`) with Auth Center (`ag4.q37fh758g.click`) using the same pattern as Creative Center (`ag1.q37fh758g.click`).

Auth Center sets a shared cookie `ac_access` on domain `.q37fh758g.click`. The Retention Center middleware checks this cookie and redirects to Auth Center login if missing/invalid. No SDK package install needed — we inline the verification logic (same as Creative Center).

---

## Constants

| Constant | Value |
|---|---|
| AUTH_CENTER_URL | `https://ag4.q37fh758g.click` |
| SELF_URL | `https://ag2.q37fh758g.click` |
| COOKIE_NAME | `ac_access` |
| COOKIE_DOMAIN | `.q37fh758g.click` |
| PROJECT_ID | `retention_center` |
| Callback URL | `https://ag2.q37fh758g.click/auth/callback` |
| Token route | `https://ag2.q37fh758g.click/auth/token` |

---

## Environment Variables

Add to `.env` on server (`/opt/retention-center/.env`):

```env
AUTH_CENTER_URL=https://ag4.q37fh758g.click
NEXT_PUBLIC_AUTH_CENTER_URL=https://ag4.q37fh758g.click
NEXT_PUBLIC_APP_URL=https://ag2.q37fh758g.click
```

`AUTH_CENTER_URL` is used server-side for token verification. `NEXT_PUBLIC_AUTH_CENTER_URL` is used client-side for login redirects.

---

## Files to Create

### 1. `src/middleware.ts` — Next.js Edge Middleware

**Purpose**: Intercept all page requests, check for `ac_access` cookie, redirect to Auth Center login if missing.

**Exact pattern** (adapted from Creative Center `middleware.ts`):

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";
const SELF_URL = "https://ag2.q37fh758g.click";

const PUBLIC_PATHS = ["/auth/", "/_next/", "/favicon.ico", "/favicon.svg", "/api/webhooks/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for ac_access cookie
  const token = request.cookies.get("ac_access");
  const tokenValue = token?.value;
  // Basic JWT format check: must have 3 dot-separated parts
  const isValidFormat = tokenValue && tokenValue.split(".").length === 3 && tokenValue.length > 20;
  if (isValidFormat) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // Redirect to Auth Center login
  const callbackUrl = `${SELF_URL}/auth/token`;
  const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg).*)"],
};
```

**Key differences from Creative Center**:
- `SELF_URL` = `https://ag2.q37fh758g.click`
- `PUBLIC_PATHS` includes `/api/webhooks/` (webhook endpoints must be accessible without auth for external services like Keitaro, Instantly, Vapi, Meta)
- `/api/` is NOT in PUBLIC_PATHS (unlike Creative Center) — API routes need auth. Webhooks are the exception.

---

### 2. `src/app/auth/token/route.ts` — Token Route Handler

**Purpose**: Auth Center redirects here after login. The shared cookie `ac_access` is already set by Auth Center on `.q37fh758g.click`. This route just redirects to app root.

```typescript
import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "ag2.q37fh758g.click";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", getBaseUrl(request)));
}
```

---

### 3. `src/app/auth/callback/page.tsx` — Auth Callback Page (Client)

**Purpose**: Handles callback with `ac_token` param or error display.

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";
const SELF_URL = "https://ag2.q37fh758g.click";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    const errorMsg = searchParams.get("error");
    const acToken = searchParams.get("ac_token");

    if (status === "error" || errorMsg) {
      setError(errorMsg || "Authentication failed");
      return;
    }

    if (acToken) {
      window.location.href = `/auth/token?ac_token=${encodeURIComponent(acToken)}`;
      return;
    }

    window.location.href = "/";
  }, [searchParams]);

  if (error) {
    const retryUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(`${SELF_URL}/auth/token`)}`;
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-red-400">Authentication Error</h1>
          <p className="mb-4 text-sm text-red-300">{error}</p>
          <a
            href={retryUrl}
            className="inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-white mx-auto" />
        <p className="text-sm text-gray-400">Authenticating...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
```

---

### 4. `src/app/auth/logout/route.ts` — Logout Route

**Purpose**: Redirects to Auth Center logout, which clears the shared cookie.

```typescript
import { NextResponse } from "next/server";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";

export async function GET() {
  return NextResponse.redirect(`${AUTH_CENTER_URL}/logout`);
}

export async function POST() {
  return NextResponse.json({ success: true });
}
```

---

### 5. `src/lib/auth.ts` — Client-Side Auth Utilities

**Purpose**: Cookie reading, auth headers, login redirect helpers.

```typescript
const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";
const SELF_URL = "https://ag2.q37fh758g.click";

/** Read a cookie value by name (client-side only). */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Get the JWT token from the shared auth cookie. */
export function getAuthToken(): string | null {
  return getCookie("ac_access");
}

/** Return Authorization header object if token exists. */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Redirect to Auth Center login page. */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const callbackUrl = `${SELF_URL}/auth/token`;
  window.location.href = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
}

/** Handle 401 response — redirect to login. */
export function handleUnauthorized(): void {
  redirectToLogin();
}
```

---

### 6. `src/lib/user-context.tsx` — User Context Provider

**Purpose**: Decode JWT on client side to provide user info for display (name, avatar, role). No server verification — display only.

```tsx
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getCookie } from "@/lib/auth";

export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
  role: string;
  project: string;
  permissions: string[];
}

interface UserContextValue {
  user: User | null;
  logout: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  logout: () => {},
});

/** Decode JWT payload without verification (client-side display only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const exp = payload.exp as number | undefined;
  if (exp && exp * 1000 < Date.now()) return null;

  return {
    id: (payload.sub as string) || "",
    telegramId: (payload.telegramId as string) || "",
    username: (payload.username as string) || null,
    firstName: (payload.firstName as string) || "User",
    photoUrl: (payload.photoUrl as string) || null,
    role: (payload.role as string) || "viewer",
    project: (payload.project as string) || "",
    permissions: (payload.permissions as string[]) || [],
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getCookie("ac_access");
    setUser(parseUserFromToken(token));

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const freshToken = getCookie("ac_access");
        const freshUser = parseUserFromToken(freshToken);
        setUser(freshUser);
        if (!freshUser) {
          window.location.href = "/auth/logout";
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ac_logout") {
        window.location.href = "/auth/logout";
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const logout = () => {
    localStorage.setItem("ac_logout", Date.now().toString());
    window.location.href = "/auth/logout";
  };

  return (
    <UserContext value={{ user, logout }}>
      {children}
    </UserContext>
  );
}

export function useUser() {
  return useContext(UserContext);
}
```

---

### 7. `src/lib/auth-server.ts` — Server-Side Token Verification

**Purpose**: Verify JWT token server-side for API route protection. Uses `jose` library (already in package.json).

```typescript
import { jwtVerify, createRemoteJWKSet } from "jose";
import { cookies } from "next/headers";

const AUTH_CENTER_URL = process.env.AUTH_CENTER_URL || "https://ag4.q37fh758g.click";

export interface AuthUser {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  email: string | null;
  role: string;
  permissions: string[];
}

// Cache for token verification results (5 min TTL)
const verifyCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Verify token by calling Auth Center /api/auth/verify endpoint.
 * Caches results for 5 minutes.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  // Check cache
  const cached = verifyCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  try {
    const response = await fetch(`${AUTH_CENTER_URL}/api/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      verifyCache.delete(token);
      return null;
    }

    const data = await response.json();
    if (!data.valid || !data.user) {
      verifyCache.delete(token);
      return null;
    }

    const user = data.user as AuthUser;
    verifyCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL });
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user from the request cookies.
 * For use in API route handlers.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ac_access")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Require authentication — returns user or throws 401 Response.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
```

---

## Files to Modify

### 8. `src/app/layout.tsx` — Root Layout

**Add** `UserProvider` wrapper around children.

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/lib/user-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Retention Center",
  description: "SMS, email, and call conversion center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <UserProvider>
          {children}
          <Toaster richColors position="top-right" />
        </UserProvider>
      </body>
    </html>
  );
}
```

---

### 9. `src/components/layout/header.tsx` — Header with Real User

**Replace** hardcoded "RC" avatar with real user data from `useUser()`.

Key changes:
- Import `useUser` from `@/lib/user-context`
- Import `Avatar, AvatarImage` (add AvatarImage)
- Show user's first name initial in AvatarFallback
- Show user's Telegram photo in AvatarImage
- Add real logout action via `logout()` from context
- Show username in dropdown

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/lib/user-context";

// ... pageTitles unchanged ...

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const { user, logout } = useUser();

  const initials = user?.firstName?.[0]?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search..." className="w-56 pl-8" />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                {user?.photoUrl && <AvatarImage src={user.photoUrl} alt={user.firstName} />}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {user?.firstName || "User"}
              {user?.username && (
                <span className="block text-xs font-normal text-muted-foreground">@{user.username}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

---

### 10. `src/components/layout/sidebar.tsx` — Sidebar with User Info

**Add** user avatar and name at the bottom of the sidebar (above external links).

Key changes:
- Import `useUser` from `@/lib/user-context`
- Import `Avatar, AvatarFallback, AvatarImage`
- Add user info section at the very bottom of sidebar

Add before the external links section:

```tsx
{/* User info */}
<div className="px-3 pb-2">
  <Separator className="mb-3" />
  {user && (
    <div className="flex items-center gap-2 px-1 py-1">
      <Avatar className="h-7 w-7">
        {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.firstName} />}
        <AvatarFallback className="text-xs">{user.firstName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 truncate">
        <p className="text-xs font-medium text-sidebar-foreground truncate">{user.firstName}</p>
        {user.username && (
          <p className="text-[10px] text-sidebar-foreground/50 truncate">@{user.username}</p>
        )}
      </div>
    </div>
  )}
</div>
```

---

### 11. API Route Protection

**All API routes except webhooks** must verify the auth token. Two approaches:

#### Approach A: Inline `getAuthUser()` call (recommended for simplicity)

Add to the top of every API handler:

```typescript
import { getAuthUser } from "@/lib/auth-server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ... existing handler logic ...
}
```

#### Routes that NEED auth protection (all under `/api/` except webhooks):

| Route Group | Files |
|---|---|
| **campaigns** | `src/app/api/campaigns/route.ts`, `[id]/route.ts`, `[id]/pause/route.ts`, `[id]/start/route.ts`, `[id]/leads/route.ts`, `[id]/stats/route.ts`, `[id]/instantly/route.ts` |
| **leads** | `src/app/api/leads/route.ts`, `[id]/route.ts`, `[id]/sms/route.ts`, `leads/bulk/route.ts`, `leads/stats/route.ts` |
| **scripts** | `src/app/api/scripts/route.ts`, `[id]/route.ts`, `[id]/duplicate/route.ts` |
| **sequences** | `src/app/api/sequences/route.ts`, `[id]/route.ts`, `[id]/activate/route.ts`, `[id]/pause/route.ts`, `[id]/enroll/route.ts`, `[id]/enrollments/route.ts`, `[id]/stats/route.ts`, `dashboard-stats/route.ts` |
| **integrations** | `src/app/api/integrations/route.ts`, `[provider]/route.ts`, `[provider]/test/route.ts`, `instantly/accounts/route.ts`, `instantly/campaigns/route.ts`, `instantly/webhook-setup/route.ts`, `vapi/assistants/route.ts`, `vapi/test-call/route.ts`, `vapi/voices/route.ts`, `vapi/phone-numbers/route.ts` |
| **conversions** | `src/app/api/conversions/route.ts`, `conversions/stats/route.ts` |
| **learning** | `src/app/api/learning/insights/route.ts`, `words/route.ts`, `ab-tests/route.ts`, `ab-tests/[id]/route.ts`, `channel-mix/route.ts`, `recommendations/route.ts`, `suggestions/route.ts`, `heatmap/route.ts`, `funnel/route.ts`, `sequence-performance/route.ts` |
| **reports** | `src/app/api/reports/overview/route.ts`, `leads/route.ts`, `campaigns/route.ts`, `timeline/route.ts`, `channels/route.ts` |
| **scheduler** | `src/app/api/scheduler/sequences/route.ts`, `process/route.ts` |
| **test-send** | `src/app/api/test-send/email/route.ts`, `sms/route.ts`, `call/route.ts` |
| **contact-attempts** | `src/app/api/contact-attempts/route.ts` |
| **instantly** | `src/app/api/instantly/analytics/route.ts` |

#### Routes that must remain PUBLIC (no auth):

| Route | Reason |
|---|---|
| `src/app/api/webhooks/sms/route.ts` | External SMS provider callbacks |
| `src/app/api/webhooks/meta/route.ts` | Meta/Facebook webhook verification |
| `src/app/api/webhooks/keitaro/route.ts` | Keitaro conversion postbacks |
| `src/app/api/webhooks/instantly/route.ts` | Instantly.ai webhook callbacks |
| `src/app/api/webhooks/email/route.ts` | Email webhook callbacks |
| `src/app/api/webhooks/vapi/route.ts` | Vapi voice AI callbacks |

---

### 12. `next.config.ts` — Add Auth Center Image Domain

```typescript
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "t.me" },
      { protocol: "https" as const, hostname: "*.telegram.org" },
      { protocol: "https" as const, hostname: "ag4.q37fh758g.click" },
    ],
  },
};

export default nextConfig;
```

---

### 13. `.env.local` (for local development)

```env
DATABASE_URL=file:./dev.db
INSTANTLY_API_KEY=placeholder
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_CENTER_URL=https://ag4.q37fh758g.click
NEXT_PUBLIC_AUTH_CENTER_URL=https://ag4.q37fh758g.click
```

---

## Nginx Changes (Server: 38.180.64.126)

### Remove Basic Auth

The current nginx config has `auth_basic` enabled. Once Auth Center handles authentication, remove it:

**Current** (`/etc/nginx/sites-available/retention-center`):
```nginx
auth_basic "Restricted";
auth_basic_user_file /etc/nginx/.htpasswd;
```

**Action**: Delete these two lines. The resulting server block:

```nginx
server {
    server_name ag2.q37fh758g.click;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/ag2.q37fh758g.click/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ag2.q37fh758g.click/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

**Note**: Added `X-Forwarded-Host` header (needed by token route's `getBaseUrl()`).

After editing: `nginx -t && systemctl reload nginx`

---

## File Summary

| Action | File | Description |
|---|---|---|
| CREATE | `src/middleware.ts` | Edge middleware — cookie check + redirect |
| CREATE | `src/app/auth/token/route.ts` | Token landing — redirect to `/` |
| CREATE | `src/app/auth/callback/page.tsx` | Callback page — error display, token relay |
| CREATE | `src/app/auth/logout/route.ts` | Logout — redirect to Auth Center |
| CREATE | `src/lib/auth.ts` | Client-side auth helpers (cookie, headers, redirect) |
| CREATE | `src/lib/user-context.tsx` | React context — decode JWT for display |
| CREATE | `src/lib/auth-server.ts` | Server-side token verification via Auth Center API |
| MODIFY | `src/app/layout.tsx` | Wrap children with `<UserProvider>` |
| MODIFY | `src/components/layout/header.tsx` | Real user avatar, name, logout |
| MODIFY | `src/components/layout/sidebar.tsx` | User info at bottom |
| MODIFY | `next.config.ts` | Add auth center image domain |
| MODIFY | `.env` (server) | Add AUTH_CENTER_URL, NEXT_PUBLIC_AUTH_CENTER_URL |
| MODIFY | All API routes (except webhooks) | Add `getAuthUser()` check |
| MODIFY | Nginx config | Remove basic auth, add X-Forwarded-Host |

---

## Auth Flow

1. User visits `https://ag2.q37fh758g.click/`
2. Middleware checks `ac_access` cookie
3. If missing/invalid: redirect to `https://ag4.q37fh758g.click/login?redirect_url=https://ag2.q37fh758g.click/auth/token`
4. User authenticates via Telegram on Auth Center
5. Auth Center sets `ac_access` cookie on `.q37fh758g.click` domain
6. Auth Center redirects to `https://ag2.q37fh758g.click/auth/token`
7. Token route redirects to `/`
8. Middleware sees valid cookie, allows through
9. `UserProvider` decodes JWT client-side for display
10. API routes verify token server-side via Auth Center `/api/auth/verify`

---

## Dependencies

- `jose` — already in `package.json` (v6.1.3). Used by `auth-server.ts` import but actual verification is done via Auth Center API call (not local JWT verify). The `jose` dependency can stay for future use but is not strictly required by this integration.

---

## Deployment Checklist

1. Create all new files listed above
2. Modify existing files as specified
3. Add env vars to server `.env`
4. Build: `npm run build`
5. Deploy to server via rsync (exclude .venv, data, node_modules, .next, .git)
6. Rebuild on server: `cd /opt/retention-center && npm run build`
7. Edit nginx: remove basic auth lines, add X-Forwarded-Host
8. Reload nginx: `nginx -t && systemctl reload nginx`
9. Restart app: `systemctl restart retention-center.service`
10. Test: visit `https://ag2.q37fh758g.click/` — should redirect to Auth Center login
