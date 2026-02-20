"use client"

const AUTH_CENTER_URL = process.env.NEXT_PUBLIC_AUTH_CENTER_URL || "https://ag4.q37fh758g.click";
const SELF_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ag2.q37fh758g.click";

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
