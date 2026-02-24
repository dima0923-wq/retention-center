"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Smartphone,
  Globe,
  Bell,
  Languages,
  ExternalLink,
  Layers,
  Users,
  BellRing,
} from "lucide-react";

type Pwa = {
  id: number;
  name: string;
  naming: string | null;
  default_lang: string | null;
  active: boolean;
  archived: boolean;
  push_enabled: boolean;
  landing_type: string | null;
  domain_id: number | null;
  countries: string[];
  languages: { id: number; lang: string }[];
};

type PwaListResponse = {
  result: string;
  data: {
    pwas: Pwa[];
    meta: { page: number; limit: number; total: number };
  };
};

type PwaStats = {
  totalPwas: number;
  activePwas: number;
  totalInstalls: number;
  pushSubscribers: number;
};

function StatsCards({ stats, loading }: { stats: PwaStats | null; loading: boolean }) {
  const cards = [
    { title: "Total PWAs", value: stats?.totalPwas ?? 0, icon: Layers },
    { title: "Active PWAs", value: stats?.activePwas ?? 0, icon: Smartphone },
    { title: "Total Installs", value: stats?.totalInstalls ?? 0, icon: Users },
    { title: "Push Subscribers", value: stats?.pushSubscribers ?? 0, icon: BellRing },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">
                {card.value.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PwaCard({ pwa }: { pwa: Pwa }) {
  return (
    <Link href={`/pwa/${pwa.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold line-clamp-1">
            {pwa.name}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {pwa.push_enabled && (
              <Badge variant="outline" className="text-xs">
                <Bell className="h-3 w-3 mr-1" />
                Push
              </Badge>
            )}
            <Badge variant={pwa.active ? "default" : "secondary"}>
              {pwa.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pwa.naming && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {pwa.naming}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {pwa.landing_type && (
              <div className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                <span>{pwa.landing_type}</span>
              </div>
            )}
            {pwa.languages.length > 0 && (
              <div className="flex items-center gap-1">
                <Languages className="h-3.5 w-3.5" />
                <span>{pwa.languages.length} lang{pwa.languages.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {pwa.countries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pwa.countries.slice(0, 5).map((country) => (
                <Badge key={country} variant="outline" className="text-xs">
                  {country}
                </Badge>
              ))}
              {pwa.countries.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{pwa.countries.length - 5}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function PwaCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        <div className="flex gap-3">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-1">
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PwaPage() {
  const [pwas, setPwas] = useState<Pwa[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [stats, setStats] = useState<PwaStats | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchPwas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (tab === "archived") params.set("archived", "true");

    try {
      const res = await fetch(`/api/pwa?${params}`);
      const data: PwaListResponse = await res.json();
      let items = data.data?.pwas ?? [];
      if (search) {
        const q = search.toLowerCase();
        items = items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.naming && p.naming.toLowerCase().includes(q))
        );
      }
      setPwas(items);
      setMeta(data.data?.meta ?? null);
    } catch (err) {
      console.error("Failed to fetch PWAs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, tab, search]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/pwa/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch PWA stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPwas();
  }, [fetchPwas]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalPages = meta?.total ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PWA Management</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your Progressive Web Apps from PwaFlow.
          </p>
        </div>
        <a
          href="https://pwaflow.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open PwaFlow
          </Button>
        </a>
      </div>

      <StatsCards stats={stats} loading={statsLoading} />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PWAs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as "active" | "archived"); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PwaCardSkeleton key={i} />
          ))}
        </div>
      ) : pwas.length === 0 ? (
        <div className="text-center py-12">
          <Smartphone className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">
            {search
              ? "No PWAs match your search."
              : tab === "archived"
                ? "No archived PWAs."
                : "No active PWAs found."}
          </p>
          <a
            href="https://pwaflow.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Create a PWA on PwaFlow
            </Button>
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pwas.map((pwa) => (
              <PwaCard key={pwa.id} pwa={pwa} />
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
