"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { ChannelIcons } from "@/components/campaigns/ChannelSelector";
import { CampaignLeadTable } from "@/components/campaigns/CampaignLeadTable";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, Play, Pause, CheckCircle, Users, TrendingUp, BarChart3 } from "lucide-react";

type CampaignDetail = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  channels: string[];
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  campaignLeads: Array<{
    id: string;
    status: string;
    assignedAt: string;
    lead: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      status: string;
    };
  }>;
  scripts: Array<{ id: string; name: string; type: string }>;
  _count: { campaignLeads: number };
};

type CampaignStats = {
  totalLeads: number;
  byStatus: Record<string, number>;
  conversionRate: number;
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const [campRes, statsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/stats`),
      ]);
      if (!campRes.ok) {
        router.push("/campaigns");
        return;
      }
      setCampaign(await campRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to fetch campaign:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleAction = async (action: "start" | "pause" | "complete") => {
    setActionLoading(true);
    try {
      let res: Response;
      if (action === "complete") {
        res = await fetch(`/api/campaigns/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
      } else {
        res = await fetch(`/api/campaigns/${id}/${action}`, { method: "POST" });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `Failed to ${action} campaign`);
      }
      toast.success(`Campaign ${action === "start" ? "started" : action === "pause" ? "paused" : "completed"}`);
      fetchCampaign();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLeads = async (leadIds: string[]) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      if (!res.ok) throw new Error("Failed to remove leads");
      toast.success("Lead removed from campaign");
      fetchCampaign();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove lead");
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="text-center py-12 text-muted-foreground">Campaign not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
          <div className="flex items-center gap-4 pt-1">
            <ChannelIcons channels={campaign.channels} />
            {campaign.startDate && (
              <span className="text-sm text-muted-foreground">
                {format(new Date(campaign.startDate), "MMM d, yyyy")}
                {campaign.endDate && ` - ${format(new Date(campaign.endDate), "MMM d, yyyy")}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "DRAFT" && (
            <Button onClick={() => handleAction("start")} disabled={actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          {campaign.status === "ACTIVE" && (
            <>
              <Button variant="outline" onClick={() => handleAction("pause")} disabled={actionLoading}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button variant="outline" onClick={() => handleAction("complete")} disabled={actionLoading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </>
          )}
          {campaign.status === "PAUSED" && (
            <>
              <Button onClick={() => handleAction("start")} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
              <Button variant="outline" onClick={() => handleAction("complete")} disabled={actionLoading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </>
          )}
          {campaign.status !== "COMPLETED" && (
            <Link href={`/campaigns/${id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus["COMPLETED"] ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byStatus["PENDING"] ?? 0} pending, {stats.byStatus["IN_PROGRESS"] ?? 0} in progress
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assigned Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignLeadTable
            leads={campaign.campaignLeads}
            onRemove={campaign.status !== "COMPLETED" ? handleRemoveLeads : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
