"use client";

import { cn } from "@/lib/utils";

type Status = "connected" | "disconnected" | "testing";

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          status === "connected" && "bg-emerald-500",
          status === "disconnected" && "bg-red-500",
          status === "testing" && "bg-yellow-500 animate-pulse"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium capitalize",
          status === "connected" && "text-emerald-600",
          status === "disconnected" && "text-red-600",
          status === "testing" && "text-yellow-600"
        )}
      >
        {status}
      </span>
    </div>
  );
}
