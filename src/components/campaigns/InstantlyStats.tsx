"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Send,
  MailOpen,
  MousePointerClick,
  MessageSquareReply,
  AlertTriangle,
  RefreshCw,
  Upload,
  Play,
  Pause,
} from "lucide-react";

export type InstantlyStatsData = {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
};

type InstantlyStatsProps = {
  stats: InstantlyStatsData | null;
  campaignId: string;
  onPullStats: () => void;
  onPushLeads: () => void;
  onLaunch: () => void;
  onPauseCampaign: () => void;
  isLoading?: boolean;
  instantlyStatus?: "active" | "paused" | "not_synced";
};

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

const STAT_CARDS = [
  { key: "sent" as const, label: "Sent", icon: Send, color: "text-blue-500" },
  { key: "opened" as const, label: "Opened", icon: MailOpen, color: "text-green-500" },
  { key: "clicked" as const, label: "Clicked", icon: MousePointerClick, color: "text-amber-500" },
  { key: "replied" as const, label: "Replied", icon: MessageSquareReply, color: "text-violet-500" },
  { key: "bounced" as const, label: "Bounced", icon: AlertTriangle, color: "text-red-500" },
];

function getRate(value: number, total: number): string {
  if (total === 0) return "0.0";
  return ((value / total) * 100).toFixed(1);
}

export function InstantlyStats({
  stats,
  onPullStats,
  onPushLeads,
  onLaunch,
  onPauseCampaign,
  isLoading,
  instantlyStatus = "not_synced",
}: InstantlyStatsProps) {
  const total = stats?.sent ?? 0;

  const chartData = stats
    ? STAT_CARDS.map((s) => ({
        name: s.label,
        value: stats[s.key],
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Instantly.ai Email Stats</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPushLeads} disabled={isLoading}>
            <Upload className="mr-2 h-4 w-4" />
            Push Leads to Instantly
          </Button>
          <Button variant="outline" size="sm" onClick={onPullStats} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Pull Stats
          </Button>
          {instantlyStatus !== "active" ? (
            <Button size="sm" onClick={onLaunch} disabled={isLoading}>
              <Play className="mr-2 h-4 w-4" />
              Launch on Instantly
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onPauseCampaign} disabled={isLoading}>
              <Pause className="mr-2 h-4 w-4" />
              Pause on Instantly
            </Button>
          )}
        </div>
      </div>

      {!stats ? (
        <p className="text-sm text-muted-foreground py-4">
          No Instantly stats available yet. Push leads and launch the campaign to get started.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STAT_CARDS.map((card) => {
              const Icon = card.icon;
              const value = stats[card.key];
              return (
                <Card key={card.key}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="text-xl font-bold">{value}</div>
                    <p className="text-xs text-muted-foreground">
                      {getRate(value, total)}%
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
