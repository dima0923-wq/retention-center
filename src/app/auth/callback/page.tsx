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

    // If ac_token is in the URL, redirect to the API route to set the cookie server-side
    if (acToken) {
      window.location.href = `/auth/token?ac_token=${encodeURIComponent(acToken)}`;
      return;
    }

    // No token param — the cookie should already be set by Auth Center cross-domain.
    window.location.href = "/";
  }, [searchParams]);

  if (error) {
    const retryUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(`${SELF_URL}/auth/token`)}`;
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-red-400">
            Authentication Error
          </h1>
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
