"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Globe,
  Bell,
  Languages,
  ExternalLink,
  Smartphone,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { PwaStatsCharts } from "@/components/pwa/PwaStatsCharts";
import { PwaLanguagesList } from "@/components/pwa/PwaLanguagesList";
import { PwaUsersList } from "@/components/pwa/PwaUsersList";
import type { PwaFlowPwa, PwaFlowStatisticsData, PwaFlowStatisticsUser, PwaFlowPaginationMeta } from "@/types/pwaflow";

type StatsResponse = {
  totalPwas: number;
  activePwas: number;
  totalInstalls: number;
  pushSubscribers: number;
  statistics: PwaFlowStatisticsData;
};

export default function PwaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [pwa, setPwa] = useState<PwaFlowPwa | null>(null);
  const [stats, setStats] = useState<PwaFlowStatisticsData | null>(null);
  const [users, setUsers] = useState<PwaFlowStatisticsUser[]>([]);
  const [usersMeta, setUsersMeta] = useState<PwaFlowPaginationMeta | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    async function fetchPwa() {
      try {
        const res = await fetch(`/api/pwa/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setPwa(data.data?.pwa ?? null);
      } catch {
        toast.error("PWA not found");
        router.push("/pwa");
      } finally {
        setLoading(false);
      }
    }
    fetchPwa();
  }, [id, router]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/pwa/stats?pwaIds=${id}&limit=50&page=${usersPage}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data: StatsResponse = await res.json();
      setStats(data.statistics);
      setUsers(data.statistics?.users ?? []);
      setUsersMeta(data.statistics?.users_meta ?? null);
    } catch (err) {
      console.error("Failed to fetch PWA stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [id, usersPage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!pwa) return null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/pwa")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to PWAs
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{pwa.name}</CardTitle>
              {pwa.naming && (
                <p className="text-sm text-muted-foreground">{pwa.naming}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pwa.push_enabled && (
                <Badge variant="outline">
                  <Bell className="h-3 w-3 mr-1" />
                  Push
                </Badge>
              )}
              <Badge variant={pwa.active ? "default" : "secondary"}>
                {pwa.active ? "Active" : "Inactive"}
              </Badge>
              {pwa.archived && (
                <Badge variant="destructive">Archived</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Landing Type</span>
              <p className="font-medium mt-0.5">{pwa.landing_type ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Default Language</span>
              <p className="font-medium mt-0.5">{pwa.default_lang ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Languages</span>
              <p className="font-medium mt-0.5">
                <Languages className="h-3.5 w-3.5 inline mr-1" />
                {pwa.languages?.length ?? 0}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Countries</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pwa.countries && pwa.countries.length > 0 ? (
                  <>
                    {pwa.countries.slice(0, 4).map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                    {pwa.countries.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{pwa.countries.length - 4}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="languages">
            <Languages className="h-4 w-4 mr-1.5" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Installs", value: stats?.events?.install ?? stats?.events?.installed ?? 0, icon: Smartphone },
              { label: "Opens", value: stats?.events?.open ?? stats?.events?.opened ?? 0, icon: ExternalLink },
              { label: "Push Subscribed", value: stats?.events?.push_subscribe ?? stats?.events?.push_subscribed ?? 0, icon: Bell },
              { label: "Unique Users", value: stats?.users?.length ?? 0, icon: Users },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {item.label}
                  </CardTitle>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="h-7 w-16 bg-muted animate-pulse rounded" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <PwaStatsCharts statistics={stats} loading={statsLoading} />
        </TabsContent>

        <TabsContent value="languages" className="mt-4">
          <PwaLanguagesList languages={pwa.languages ?? []} />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <PwaUsersList
            users={users}
            meta={usersMeta}
            page={usersPage}
            onPageChange={setUsersPage}
            loading={statsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
