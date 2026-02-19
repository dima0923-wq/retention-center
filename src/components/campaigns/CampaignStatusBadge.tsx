"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  PAUSED: { label: "Paused", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "destructive" },
};

export function CampaignStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
