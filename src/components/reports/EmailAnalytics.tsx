"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatsCard } from "@/components/reports/StatsCard";
import {
  Mail,
  MailOpen,
  MousePointerClick,
  MessageSquareReply,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type EmailStats = {
  totalSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  timeline: {
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }[];
  topCampaigns: {
    id: string;
    name: string;
    sent: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }[];
  accountHealth: {
    provider: string;
    status: string;
    successRate: number;
  }[];
};

type EmailAnalyticsProps = {
  from: string;
  to: string;
};

export function EmailAnalytics({ from, to }: EmailAnalyticsProps) {
  const [data, setData] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/channels?channel=EMAIL&from=${from}&to=${to}`
      );
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch email analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading email analytics...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const timelineFormatted = (data.timeline ?? []).map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Email Analytics</h3>

      {/* Email stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Sent"
          value={data.totalSent}
          icon={Mail}
        />
        <StatsCard
          title="Open Rate"
          value={`${data.openRate}%`}
          icon={MailOpen}
        />
        <StatsCard
          title="Click Rate"
          value={`${data.clickRate}%`}
          icon={MousePointerClick}
        />
        <StatsCard
          title="Reply Rate"
          value={`${data.replyRate}%`}
          icon={MessageSquareReply}
        />
        <StatsCard
          title="Bounce Rate"
          value={`${data.bounceRate}%`}
          icon={AlertTriangle}
        />
      </div>

      {/* Email timeline chart */}
      {timelineFormatted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Email Activity Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineFormatted}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="dateLabel" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="opened"
                    name="Opened"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicked"
                    name="Clicked"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="replied"
                    name="Replied"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top campaigns table */}
      {data.topCampaigns && data.topCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Best Performing Email Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Campaign</th>
                    <th className="pb-2 font-medium text-right">Sent</th>
                    <th className="pb-2 font-medium text-right">Open Rate</th>
                    <th className="pb-2 font-medium text-right">Click Rate</th>
                    <th className="pb-2 font-medium text-right">Reply Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCampaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2">{c.name}</td>
                      <td className="py-2 text-right">{c.sent}</td>
                      <td className="py-2 text-right">{c.openRate}%</td>
                      <td className="py-2 text-right">{c.clickRate}%</td>
                      <td className="py-2 text-right">{c.replyRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account health */}
      {data.accountHealth && data.accountHealth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Email Account Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.accountHealth.map((account, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{account.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          account.successRate >= 90
                            ? "bg-emerald-500"
                            : account.successRate >= 70
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${account.successRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">
                      {account.successRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
