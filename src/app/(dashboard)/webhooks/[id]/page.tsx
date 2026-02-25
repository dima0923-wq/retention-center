"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Copy,
  Check,
  Pencil,
  Trash2,
  Users,
  CalendarDays,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { WebhookActivity } from "@/components/webhooks/webhook-activity";
import {
  WebhookFormDialog,
  type WebhookFormData,
} from "@/components/webhooks/webhook-form";
import type { Webhook } from "@/components/webhooks/webhook-list";

const BASE_URL = "https://ag2.q37fh758g.click";

const typeBadgeColors: Record<string, string> = {
  zapier: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  generic: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

type LeadEntry = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

function computeStats(leads: LeadEntry[]) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  for (const lead of leads) {
    const d = new Date(lead.createdAt);
    if (d >= startOfDay) today++;
    if (d >= startOfWeek) thisWeek++;
    if (d >= startOfMonth) thisMonth++;
  }

  return { today, thisWeek, thisMonth };
}

export default function WebhookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchWebhook = useCallback(async () => {
    try {
      const res = await fetch(`/api/webhooks/config/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setWebhook(data);
    } catch {
      toast.error("Webhook not found");
      router.push("/webhooks");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch(`/api/webhooks/config/${id}/activity`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : data.leads ?? data.data ?? []);
    } catch {
      console.error("Failed to fetch leads");
    } finally {
      setLeadsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWebhook();
    fetchLeads();
  }, [fetchWebhook, fetchLeads]);

  const webhookUrl = webhook ? `${BASE_URL}/api/webhooks/inbound/${webhook.slug}` : "";
  const stats = computeStats(leads);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async (isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      setWebhook((prev) => (prev ? { ...prev, isActive } : prev));
      toast.success(isActive ? "Webhook activated" : "Webhook deactivated");
    } catch {
      toast.error("Failed to toggle webhook");
    }
  };

  const handleEdit = async (data: WebhookFormData) => {
    setEditLoading(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        sourceLabel: data.sourceLabel,
        isActive: data.active,
        campaignId: data.campaignId || undefined,
        sequenceId: data.sequenceId || undefined,
        verifyToken: data.verifyToken || undefined,
        pageAccessToken: data.pageAccessToken || undefined,
        fieldMapping: data.fieldMapping,
      };
      const res = await fetch(`/api/webhooks/config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update");
      }
      toast.success("Webhook updated");
      setEditOpen(false);
      fetchWebhook();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update webhook"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/webhooks/config/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Webhook deleted");
      router.push("/webhooks");
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading webhook...
      </div>
    );
  }

  if (!webhook) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/webhooks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {webhook.name}
            </h2>
            <Badge
              variant="outline"
              className={typeBadgeColors[webhook.type] ?? typeBadgeColors.generic}
            >
              {webhook.type}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Source: {webhook.sourceLabel || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={webhook.isActive}
            onCheckedChange={handleToggle}
          />
          <span className="text-sm text-muted-foreground">
            {webhook.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Webhook URL</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="truncate max-w-[200px]">{webhookUrl}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="h-3 w-3 shrink-0" />
              )}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <CalendarDays className="h-3 w-3" /> Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.today}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" /> This Week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.thisWeek}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" /> This Month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.thisMonth}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription className="text-xs">
              Webhook settings and field mapping
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd className="font-medium">{webhook.campaign?.name ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sequence</dt>
              <dd className="font-medium">{webhook.sequence?.name ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {new Date(webhook.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Leads</dt>
              <dd className="font-medium">{webhook.leadCount ?? 0}</dd>
            </div>
            {webhook.fieldMapping && Object.keys(webhook.fieldMapping).length > 0 && (
              <div className="col-span-2">
                <dt className="text-muted-foreground mb-1">Field Mapping</dt>
                <dd>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(webhook.fieldMapping).map(([from, to]) => (
                      <span
                        key={from}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-mono"
                      >
                        {from} &rarr; {to}
                      </span>
                    ))}
                  </div>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <WebhookActivity leads={leads} loading={leadsLoading} />
      </div>

      <WebhookFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        initialData={{
          id: webhook.id,
          name: webhook.name,
          type: webhook.type,
          sourceLabel: webhook.sourceLabel ?? "",
          active: webhook.isActive,
          campaignId: webhook.campaignId ?? "",
          sequenceId: webhook.sequenceId ?? "",
          verifyToken: webhook.verifyToken ?? "",
          pageAccessToken: "",
          fieldMapping: webhook.fieldMapping ?? {},
        }}
        loading={editLoading}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{webhook.name}&quot;? This
              will stop receiving leads from this webhook. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
