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
  loading: boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
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

  // Check expiration
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getCookie("ac_access");
    setUser(parseUserFromToken(token));
    setLoading(false);

    // bfcache protection: re-check auth when page is restored from back-forward cache
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

    // Cross-tab logout: when another tab logs out, redirect this tab too
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
    // Signal other tabs to logout
    localStorage.setItem("ac_logout", Date.now().toString());
    // Redirect to server-side logout route which redirects to Auth Center
    window.location.href = "/auth/logout";
  };

  return (
    <UserContext value={{ user, loading, logout }}>
      {children}
    </UserContext>
  );
}

export function useUser() {
  return useContext(UserContext);
}
