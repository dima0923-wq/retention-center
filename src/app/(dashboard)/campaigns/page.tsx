"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Plus, Search } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  channels: string[];
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  _count: { campaignLeads: number };
};

type CampaignListData = {
  data: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListData | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "12");
    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/campaigns?${params}`);
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground mt-1">
            Create and manage outreach campaigns.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
      ) : !campaigns?.data.length ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No campaigns found.</p>
          <Link href="/campaigns/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create your first campaign
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.data.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>

          {campaigns.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {campaigns.page} of {campaigns.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= campaigns.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
