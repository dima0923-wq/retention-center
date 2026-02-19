"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-blue-100 text-blue-800 border-blue-200" },
  CONTACTED: { label: "Contacted", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-purple-100 text-purple-800 border-purple-200" },
  CONVERTED: { label: "Converted", className: "bg-green-100 text-green-800 border-green-200" },
  LOST: { label: "Lost", className: "bg-gray-100 text-gray-800 border-gray-200" },
  DO_NOT_CONTACT: { label: "Do Not Contact", className: "bg-red-100 text-red-800 border-red-200" },
};

export function LeadStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
