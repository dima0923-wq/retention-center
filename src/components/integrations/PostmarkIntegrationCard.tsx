"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Loader2,
  CheckCircle,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Radio,
  Mail,
  MousePointerClick,
  Eye,
  XCircle,
  Plus,
  Globe,
  UserCheck,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface PostmarkOverview {
  Sent: number;
  Bounced: number;
  SMTPApiErrors: number;
  BounceRate: number;
  SpamComplaints: number;
  SpamComplaintsRate: number;
  Opens: number;
  UniqueOpens: number;
  Tracked: number;
  WithClientRecorded: number;
  WithPlatformRecorded: number;
  WithReadTimeRecorded: number;
  TotalClicks: number;
  UniqueLinksClicked: number;
  TotalTrackedLinksSent: number;
  WithLinkTracking: number;
  WithOpenTracking: number;
}

interface PostmarkBounce {
  ID: number;
  Type: string;
  TypeCode: number;
  Name: string;
  Email: string;
  BouncedAt: string;
  Description: string;
  Inactive: boolean;
  Subject: string;
}

interface PostmarkStream {
  ID: string;
  ServerID: number;
  Name: string;
  Description: string;
  MessageStreamType: string;
  ArchivedAt: string | null;
}

interface PostmarkSender {
  ID: number;
  Domain: string;
  EmailAddress: string;
  Name: string;
  ReplyToEmailAddress: string;
  Confirmed: boolean;
}

interface PostmarkDomain {
  ID: number;
  Name: string;
  SPFVerified: boolean;
  DKIMVerified: boolean;
  ReturnPathDomainVerified: boolean;
  ReturnPathDomain: string;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PostmarkIntegrationCard() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [serverName, setServerName] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ overview: PostmarkOverview } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Bounces
  const [bounces, setBounces] = useState<PostmarkBounce[]>([]);
  const [bouncesTotalCount, setBouncesTotalCount] = useState(0);
  const [loadingBounces, setLoadingBounces] = useState(false);

  // Streams
  const [streams, setStreams] = useState<PostmarkStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);

  // Senders
  const [senders, setSenders] = useState<PostmarkSender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [sendersLoaded, setSendersLoaded] = useState(false);

  // Domains
  const [domains, setDomains] = useState<PostmarkDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [domainsLoaded, setDomainsLoaded] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const hasAccountToken = Boolean(config.accountToken);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const res = await fetch("/api/integrations/postmark/test");
      if (res.ok) {
        const data = await res.json();
        setServerName(data.serverName ?? data.name ?? null);
      }
    } catch {
      // supplementary
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/integrations/postmark/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchBounces = useCallback(async () => {
    setLoadingBounces(true);
    try {
      const res = await fetch("/api/integrations/postmark/bounces?count=25&offset=0");
      if (res.ok) {
        const data = await res.json();
        setBounces(data.bounces ?? []);
        setBouncesTotalCount(data.totalCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoadingBounces(false);
    }
  }, []);

  const fetchStreams = useCallback(async () => {
    setLoadingStreams(true);
    try {
      const res = await fetch("/api/integrations/postmark/streams");
      if (res.ok) {
        const data = await res.json();
        setStreams(data.streams ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingStreams(false);
    }
  }, []);

  const fetchSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const res = await fetch("/api/integrations/postmark/senders");
      if (res.ok) {
        const data = await res.json();
        setSenders(data.SenderSignatures ?? []);
        setSendersLoaded(true);
      }
    } catch {
      // silent
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    setLoadingDomains(true);
    try {
      const res = await fetch("/api/integrations/postmark/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.Domains ?? []);
        setDomainsLoaded(true);
      }
    } catch {
      // silent
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/integrations/postmark")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.config) {
          try {
            const parsed =
              typeof data.config === "string"
                ? JSON.parse(data.config)
                : data.config;
            setConfig(parsed as Record<string, string>);
            setIsActive(data.isActive);
          } catch {
            // malformed
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDetails();
      fetchStreams();
    }
  }, [isActive, fetchDetails, fetchStreams]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "postmark",
          type: "EMAIL",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Postmark configuration saved");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const res = await fetch("/api/integrations/postmark", {
      method: "DELETE",
    });
    if (res.ok) {
      setIsActive(false);
      setServerName(null);
      setStats(null);
      setBounces([]);
      setStreams([]);
      setSenders([]);
      setDomains([]);
      setSendersLoaded(false);
      setDomainsLoaded(false);
      toast.success("Postmark deactivated");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/postmark/test");
      if (res.ok) {
        const data = await res.json();
        setServerName(data.serverName ?? data.name ?? null);
        toast.success("Postmark connection verified");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Connection test failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  };

  const status = loading
    ? "testing"
    : isActive
      ? "connected"
      : "disconnected";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Postmark</CardTitle>
            <CardDescription className="text-xs">
              Transactional email delivery via Postmark
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent>
        {!isActive ? (
          <ConfigTab
            config={config}
            updateField={updateField}
            baseUrl={baseUrl}
            streams={[]}
            loadingStreams={false}
            saving={saving}
            isActive={isActive}
            onSave={handleSave}
            onDeactivate={handleDeactivate}
          />
        ) : (
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="stats" onClick={() => { if (!stats) fetchStats(); }}>
                Stats
              </TabsTrigger>
              <TabsTrigger value="senders" onClick={() => { if (!sendersLoaded && hasAccountToken) fetchSenders(); }}>
                Senders
              </TabsTrigger>
              <TabsTrigger value="domains" onClick={() => { if (!domainsLoaded && hasAccountToken) fetchDomains(); }}>
                Domains
              </TabsTrigger>
              <TabsTrigger value="bounces" onClick={() => { if (bounces.length === 0) fetchBounces(); }}>
                Bounces
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="mt-4">
              <ConfigTab
                config={config}
                updateField={updateField}
                baseUrl={baseUrl}
                streams={streams}
                loadingStreams={loadingStreams}
                saving={saving}
                isActive={isActive}
                onSave={handleSave}
                onDeactivate={handleDeactivate}
                serverName={serverName}
                loadingDetails={loadingDetails}
                testing={testing}
                onRefreshDetails={fetchDetails}
                onTestConnection={handleTestConnection}
                onRefreshStreams={fetchStreams}
              />
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <StatsTab
                stats={stats}
                loading={loadingStats}
                onRefresh={fetchStats}
              />
            </TabsContent>

            <TabsContent value="senders" className="mt-4">
              <SendersTab
                senders={senders}
                loading={loadingSenders}
                onRefresh={fetchSenders}
                hasAccountToken={hasAccountToken}
              />
            </TabsContent>

            <TabsContent value="domains" className="mt-4">
              <DomainsTab
                domains={domains}
                loading={loadingDomains}
                onRefresh={fetchDomains}
                hasAccountToken={hasAccountToken}
              />
            </TabsContent>

            <TabsContent value="bounces" className="mt-4">
              <BouncesTab
                bounces={bounces}
                totalCount={bouncesTotalCount}
                loading={loadingBounces}
                onRefresh={fetchBounces}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────

function ConfigTab({
  config,
  updateField,
  baseUrl,
  streams,
  loadingStreams,
  saving,
  isActive,
  onSave,
  onDeactivate,
  serverName,
  loadingDetails,
  testing,
  onRefreshDetails,
  onTestConnection,
  onRefreshStreams,
}: {
  config: Record<string, string>;
  updateField: (key: string, value: string) => void;
  baseUrl: string;
  streams: PostmarkStream[];
  loadingStreams: boolean;
  saving: boolean;
  isActive: boolean;
  onSave: () => void;
  onDeactivate: () => void;
  serverName?: string | null;
  loadingDetails?: boolean;
  testing?: boolean;
  onRefreshDetails?: () => void;
  onTestConnection?: () => void;
  onRefreshStreams?: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Server Token */}
      <div className="space-y-1.5">
        <Label htmlFor="postmark-serverToken" className="text-xs">
          Server Token
        </Label>
        <Input
          id="postmark-serverToken"
          type="password"
          placeholder="Your Postmark Server Token"
          value={config.serverToken ?? ""}
          onChange={(e) => updateField("serverToken", e.target.value)}
        />
      </div>

      {/* Account Token */}
      <div className="space-y-1.5">
        <Label htmlFor="postmark-accountToken" className="text-xs">
          Account Token{" "}
          <span className="text-muted-foreground">(required for Senders &amp; Domains)</span>
        </Label>
        <Input
          id="postmark-accountToken"
          type="password"
          placeholder="Your Postmark Account Token"
          value={config.accountToken ?? ""}
          onChange={(e) => updateField("accountToken", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Found in Postmark → Account → API Tokens. Different from the Server Token above.
        </p>
      </div>

      {/* From Email */}
      <div className="space-y-1.5">
        <Label htmlFor="postmark-fromEmail" className="text-xs">
          From Email
        </Label>
        <Input
          id="postmark-fromEmail"
          type="email"
          placeholder="noreply@example.com"
          value={config.fromEmail ?? ""}
          onChange={(e) => updateField("fromEmail", e.target.value)}
        />
      </div>

      {/* From Name */}
      <div className="space-y-1.5">
        <Label htmlFor="postmark-fromName" className="text-xs">
          From Name
        </Label>
        <Input
          id="postmark-fromName"
          type="text"
          placeholder="Retention Center"
          value={config.fromName ?? ""}
          onChange={(e) => updateField("fromName", e.target.value)}
        />
      </div>

      {/* Message Stream Selector */}
      {isActive && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Message Stream</Label>
            {onRefreshStreams && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onRefreshStreams}
                disabled={loadingStreams}
              >
                <RefreshCw
                  className={`h-3 w-3 ${loadingStreams ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>
          {streams.length > 0 ? (
            <Select
              value={config.messageStream || "outbound"}
              onValueChange={(val) => updateField("messageStream", val)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select stream" />
              </SelectTrigger>
              <SelectContent>
                {streams
                  .filter((s) => !s.ArchivedAt)
                  .map((s) => (
                    <SelectItem key={s.ID} value={s.ID}>
                      <span>{s.Name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-2 text-xs font-normal"
                      >
                        {s.MessageStreamType}
                      </Badge>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="text"
              placeholder={loadingStreams ? "Loading streams..." : "outbound"}
              value={config.messageStream ?? ""}
              onChange={(e) => updateField("messageStream", e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Use &quot;outbound&quot; for transactional or &quot;broadcast&quot; for marketing emails.
          </p>
        </div>
      )}

      {/* Webhook URL */}
      <WebhookUrlDisplay
        label="Webhook URL"
        url={`${baseUrl}/api/webhooks/postmark`}
      />

      {/* Post-connection details */}
      {isActive && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Connection Details</span>
            {onRefreshDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onRefreshDetails}
                disabled={loadingDetails}
              >
                <RefreshCw
                  className={`h-3 w-3 ${loadingDetails ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>

          {serverName && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Server: {serverName}</span>
            </div>
          )}

          {onTestConnection && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onTestConnection}
              disabled={testing}
            >
              {testing && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Test Connection
            </Button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {isActive && (
          <Button variant="ghost" size="sm" onClick={onDeactivate}>
            Deactivate
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Stats Tab ──────────────────────────────────────────────────────────────

function StatsTab({
  stats,
  loading,
  onRefresh,
}: {
  stats: { overview: PostmarkOverview } | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const o = stats?.overview;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Delivery Statistics</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && !o && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {o && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Mail className="h-4 w-4 text-blue-500" />}
            label="Sent"
            value={o.Sent}
          />
          <StatCard
            icon={<Eye className="h-4 w-4 text-emerald-500" />}
            label="Opens"
            value={o.UniqueOpens}
            subtext={`${o.Opens} total`}
          />
          <StatCard
            icon={<MousePointerClick className="h-4 w-4 text-violet-500" />}
            label="Clicks"
            value={o.UniqueLinksClicked}
            subtext={`${o.TotalClicks} total`}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            label="Bounced"
            value={o.Bounced}
            subtext={`${(o.BounceRate * 100).toFixed(1)}%`}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-red-500" />}
            label="Spam"
            value={o.SpamComplaints}
            subtext={`${(o.SpamComplaintsRate * 100).toFixed(2)}%`}
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4 text-cyan-500" />}
            label="Tracked"
            value={o.Tracked}
          />
          <StatCard
            icon={<Radio className="h-4 w-4 text-orange-500" />}
            label="SMTP Errors"
            value={o.SMTPApiErrors}
          />
          <StatCard
            icon={<Send className="h-4 w-4 text-indigo-500" />}
            label="Link Tracking"
            value={o.WithLinkTracking}
          />
        </div>
      )}

      {!loading && !o && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No stats available. Click Refresh to load.
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold">{value.toLocaleString()}</span>
      {subtext && (
        <span className="text-xs text-muted-foreground">{subtext}</span>
      )}
    </div>
  );
}

// ── Senders Tab ────────────────────────────────────────────────────────────

function SendersTab({
  senders,
  loading,
  onRefresh,
  hasAccountToken,
}: {
  senders: PostmarkSender[];
  loading: boolean;
  onRefresh: () => void;
  hasAccountToken: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  if (!hasAccountToken) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <UserCheck className="mb-2 h-8 w-8" />
        <p className="text-sm font-medium">Account Token Required</p>
        <p className="text-xs mt-1 text-center max-w-sm">
          Add your Postmark <strong>Account Token</strong> in the Config tab to manage sender signatures.
          This is different from the Server Token — find it at Postmark → Account → API Tokens.
        </p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!addEmail || !addName) return;
    setAdding(true);
    try {
      const res = await fetch("/api/integrations/postmark/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail: addEmail, name: addName }),
      });
      if (res.ok) {
        toast.success("Sender created — check email for confirmation");
        setAddOpen(false);
        setAddName("");
        setAddEmail("");
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create sender");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sender Signatures</span>
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7">
                <Plus className="mr-1 h-3 w-3" />
                Add Sender
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Sender Signature</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sender Name</Label>
                  <Input
                    placeholder="Retention Center"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="noreply@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleAdd}
                  disabled={adding || !addEmail || !addName}
                >
                  {adding && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Create Sender
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && senders.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {senders.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Domain</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {senders.map((s) => (
                <TableRow key={s.ID}>
                  <TableCell className="text-xs font-medium">{s.Name}</TableCell>
                  <TableCell className="text-xs">{s.EmailAddress}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.Domain}
                  </TableCell>
                  <TableCell>
                    {s.Confirmed ? (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                        Confirmed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && senders.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No sender signatures found. Add one to get started.
        </p>
      )}
    </div>
  );
}

// ── Domains Tab ────────────────────────────────────────────────────────────

function DomainsTab({
  domains,
  loading,
  onRefresh,
  hasAccountToken,
}: {
  domains: PostmarkDomain[];
  loading: boolean;
  onRefresh: () => void;
  hasAccountToken: boolean;
}) {
  const [verifying, setVerifying] = useState<number | null>(null);

  if (!hasAccountToken) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Globe className="mb-2 h-8 w-8" />
        <p className="text-sm font-medium">Account Token Required</p>
        <p className="text-xs mt-1 text-center max-w-sm">
          Add your Postmark <strong>Account Token</strong> in the Config tab to manage domain verification.
          This is different from the Server Token — find it at Postmark → Account → API Tokens.
        </p>
      </div>
    );
  }

  const handleVerify = async (domainId: number, action: "verifyDKIM" | "verifyReturnPath") => {
    setVerifying(domainId);
    try {
      const res = await fetch("/api/integrations/postmark/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action }),
      });
      if (res.ok) {
        toast.success(`${action === "verifyDKIM" ? "DKIM" : "Return-Path"} verification triggered`);
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Verification failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Domain Verification</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && domains.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {domains.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Domain</TableHead>
                <TableHead className="text-xs">SPF</TableHead>
                <TableHead className="text-xs">DKIM</TableHead>
                <TableHead className="text-xs">Return-Path</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <TableRow key={d.ID}>
                  <TableCell className="text-xs font-medium">{d.Name}</TableCell>
                  <TableCell>
                    <VerificationBadge verified={d.SPFVerified} />
                  </TableCell>
                  <TableCell>
                    <VerificationBadge verified={d.DKIMVerified} />
                  </TableCell>
                  <TableCell>
                    <VerificationBadge verified={d.ReturnPathDomainVerified} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!d.DKIMVerified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => handleVerify(d.ID, "verifyDKIM")}
                          disabled={verifying === d.ID}
                        >
                          {verifying === d.ID ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              DKIM
                            </>
                          )}
                        </Button>
                      )}
                      {!d.ReturnPathDomainVerified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => handleVerify(d.ID, "verifyReturnPath")}
                          disabled={verifying === d.ID}
                        >
                          {verifying === d.ID ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <ArrowRight className="mr-1 h-3 w-3" />
                              Return-Path
                            </>
                          )}
                        </Button>
                      )}
                      {d.DKIMVerified && d.ReturnPathDomainVerified && (
                        <span className="text-xs text-emerald-600">All verified</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && domains.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Globe className="mb-2 h-8 w-8" />
          <p className="text-sm">No domains found</p>
          <p className="text-xs">Add a domain in your Postmark account to verify it here.</p>
        </div>
      )}
    </div>
  );
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
      <CheckCircle className="mr-1 h-3 w-3" />
      Verified
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Pending
    </Badge>
  );
}

// ── Bounces Tab ────────────────────────────────────────────────────────────

function BouncesTab({
  bounces,
  totalCount,
  loading,
  onRefresh,
}: {
  bounces: PostmarkBounce[];
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Recent Bounces</span>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalCount} total
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && bounces.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {bounces.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bounces.map((b) => (
                <TableRow key={b.ID}>
                  <TableCell className="text-xs font-medium max-w-[180px] truncate">
                    {b.Email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={b.TypeCode === 1 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {b.Name || b.Type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {b.Subject || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(b.BouncedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {b.Inactive ? (
                      <Badge variant="destructive" className="text-xs">
                        Inactive
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && bounces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm">No bounces found</p>
          <p className="text-xs">Your email delivery is clean!</p>
        </div>
      )}
    </div>
  );
}
