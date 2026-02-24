"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Globe, Calendar } from "lucide-react";

type PushMessage = {
  id?: number;
  lang?: string;
  title?: string;
  body?: string;
};

type PushSchedule = {
  schedule_type?: string;
  time?: string | null;
  days?: string[];
  repeat?: boolean;
};

type PushCampaignCardProps = {
  push: {
    id?: number;
    name?: string;
    active?: boolean;
    archived?: boolean;
    default_lang?: string | null;
    pwa_ids?: number[];
    messages?: PushMessage[];
    schedules?: PushSchedule[];
  };
};

export function PushCampaignCard({ push }: PushCampaignCardProps) {
  const defaultMsg = push.messages?.find((m) => m.lang === push.default_lang) ?? push.messages?.[0];

  return (
    <Link href={`/pwa/pushes/${push.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold line-clamp-1">
            {push.name ?? `Push #${push.id}`}
          </CardTitle>
          <Badge variant={push.active ? "default" : "secondary"}>
            {push.archived ? "Archived" : push.active ? "Active" : "Inactive"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {defaultMsg && (
            <div className="flex items-start gap-2">
              <Bell className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-1">{defaultMsg.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{defaultMsg.body}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {push.messages && push.messages.length > 0 && (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>{push.messages.length} lang{push.messages.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {push.pwa_ids && push.pwa_ids.length > 0 && (
              <span>{push.pwa_ids.length} PWA{push.pwa_ids.length !== 1 ? "s" : ""}</span>
            )}
            {push.schedules && push.schedules.length > 0 && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{push.schedules.length} schedule{push.schedules.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
