"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChannelIcons } from "@/components/campaigns/ChannelSelector";
import { Users, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  PAUSED: { label: "Paused", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "destructive" },
};

const triggerLabels: Record<string, string> = {
  manual: "Manual",
  new_lead: "New Lead",
  no_conversion: "No Conversion",
};

type SequenceCardProps = {
  sequence: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    channels: string;
    triggerType: string;
    createdAt: string;
    _count: { steps: number; enrollments: number };
    conversionRate?: number;
  };
};

export function SequenceCard({ sequence }: SequenceCardProps) {
  const channels = (() => {
    try {
      return JSON.parse(sequence.channels);
    } catch {
      return [];
    }
  })();

  const statusCfg = statusConfig[sequence.status] ?? {
    label: sequence.status,
    variant: "secondary" as const,
  };

  return (
    <Link href={`/sequences/${sequence.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{sequence.name}</CardTitle>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </CardHeader>
        <CardContent>
          {sequence.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {sequence.description}
            </p>
          )}
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs">
              {triggerLabels[sequence.triggerType] ?? sequence.triggerType}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {sequence._count.steps} step{sequence._count.steps !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ChannelIcons channels={channels} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{sequence._count.enrollments}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(sequence.createdAt), "MMM d, yyyy")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
