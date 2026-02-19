"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Megaphone, TrendingUp, PhoneCall, Zap, CheckCircle, DollarSign, Target } from "lucide-react";
import { StatsCard } from "@/components/reports/StatsCard";
import {
  DateRangePicker,
  getDateRange,
} from "@/components/reports/DateRangePicker";
import { ConversionFunnel } from "@/components/reports/ConversionFunnel";
import { ChannelPerformanceChart } from "@/components/reports/ChannelPerformanceChart";
import { TimelineChart } from "@/components/reports/TimelineChart";
import { CampaignComparisonTable } from "@/components/reports/CampaignComparisonTable";
import { ExportButton } from "@/components/reports/ExportButton";
import { EmailAnalytics } from "@/components/reports/EmailAnalytics";

type DateRangePreset = "7d" | "30d" | "90d" | "custom";

type OverviewStats = {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  activeCampaigns: number;
  totalAttempts: number;
  successfulAttempts: number;
  conversionRate: number;
  successRate: number;
  totalConversions: number;
  totalRevenue: number;
};

type ChannelData = {
  channel: string;
  total: number;
  successful: number;
  successRate: number;
  avgDuration: number | null;
  avgCost: number | null;
};

type FunnelData = { status: string; count: number };
type TimelineData = {
  date: string;
  leads: number;
  attempts: number;
  conversions: number;
};
type CampaignData = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  totalLeads: number;
  completed: number;
  conversionRate: number;
};

export default function ReportsPage() {
  const [preset, setPreset] = useState<DateRangePreset>("30d");
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [funnel, setFunnel] = useState<FunnelData[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(preset);
    const params = `from=${from.toISOString()}&to=${to.toISOString()}`;

    try {
      const [overviewRes, channelsRes, funnelRes, timelineRes, campaignsRes] =
        await Promise.all([
          fetch(`/api/reports/overview?${params}`),
          fetch(`/api/reports/channels?${params}`),
          fetch(`/api/reports/leads?${params}`),
          fetch(`/api/reports/timeline?${params}`),
          fetch(`/api/reports/campaigns?${params}`),
        ]);

      const [overviewData, channelsData, funnelData, timelineData, campaignsData] =
        await Promise.all([
          overviewRes.json(),
          channelsRes.json(),
          funnelRes.json(),
          timelineRes.json(),
          campaignsRes.json(),
        ]);

      setOverview(overviewData);
      setChannels(channelsData);
      setFunnel(funnelData);
      setTimeline(timelineData);
      setCampaigns(campaignsData);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header with date picker and export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground mt-1">
            View analytics and performance reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker selected={preset} onSelect={setPreset} />
          <ExportButton
            data={campaigns as unknown as Record<string, unknown>[]}
            filename="campaigns-report.csv"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Leads"
              value={overview?.totalLeads ?? 0}
              icon={Users}
            />
            <StatsCard
              title="Active Campaigns"
              value={overview?.activeCampaigns ?? 0}
              icon={Megaphone}
            />
            <StatsCard
              title="Conversion Rate"
              value={`${overview?.conversionRate ?? 0}%`}
              icon={TrendingUp}
            />
            <StatsCard
              title="Total Attempts"
              value={overview?.totalAttempts ?? 0}
              icon={PhoneCall}
            />
            <StatsCard
              title="Successful"
              value={overview?.successfulAttempts ?? 0}
              icon={CheckCircle}
            />
            <StatsCard
              title="Success Rate"
              value={`${overview?.successRate ?? 0}%`}
              icon={Zap}
            />
            <StatsCard
              title="Conversions"
              value={overview?.totalConversions ?? 0}
              icon={Target}
            />
            <StatsCard
              title="Revenue"
              value={`$${(overview?.totalRevenue ?? 0).toLocaleString()}`}
              icon={DollarSign}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ConversionFunnel data={funnel} />
            <ChannelPerformanceChart data={channels} />
          </div>

          {/* Timeline */}
          <TimelineChart data={timeline} />

          {/* Campaign comparison table */}
          <CampaignComparisonTable data={campaigns} />

          {/* Email Analytics */}
          <EmailAnalytics
            from={getDateRange(preset).from.toISOString()}
            to={getDateRange(preset).to.toISOString()}
          />
        </>
      )}
    </div>
  );
}
