"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell } from "lucide-react";
import { PushCampaignCard } from "@/components/pwa/PushCampaignCard";
import { InstantPushDialog } from "@/components/pwa/InstantPushDialog";

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

type Push = {
  id?: number;
  name?: string;
  active?: boolean;
  archived?: boolean;
  default_lang?: string | null;
  pwa_ids?: number[];
  messages?: PushMessage[];
  schedules?: PushSchedule[];
};

type PushListResponse = {
  result: string;
  data: {
    pushes: Push[];
    meta: { page: number; limit: number; total: number };
  };
};

function PushCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex justify-between">
        <div className="h-5 w-36 bg-muted animate-pulse rounded" />
        <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
    </div>
  );
}

export default function PushesPage() {
  const [pushes, setPushes] = useState<Push[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPushes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (tab === "archived") params.set("archived", "true");

    try {
      const res = await fetch(`/api/pwa/pushes?${params}`);
      const data: PushListResponse = await res.json();
      setPushes(data.data?.pushes ?? []);
      setMeta(data.data?.meta ?? null);
    } catch (err) {
      console.error("Failed to fetch pushes:", err);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    fetchPushes();
  }, [fetchPushes]);

  const totalPages = meta?.total ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Push Notifications</h2>
          <p className="text-muted-foreground mt-1">
            Manage push campaigns and send instant notifications via PwaFlow.
          </p>
        </div>
        <InstantPushDialog />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as "active" | "archived"); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PushCardSkeleton key={i} />
          ))}
        </div>
      ) : pushes.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {tab === "archived" ? "No archived push campaigns." : "No active push campaigns found."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pushes.map((push) => (
              <PushCampaignCard key={push.id} push={push} />
            ))}
          </div>

          {totalPages > 1 && (
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
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
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
