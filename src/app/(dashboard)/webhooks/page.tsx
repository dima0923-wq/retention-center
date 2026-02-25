"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Info, Webhook as WebhookIcon } from "lucide-react";
import { toast } from "sonner";
import { WebhookList, type Webhook } from "@/components/webhooks/webhook-list";
import {
  WebhookFormDialog,
  type WebhookFormData,
} from "@/components/webhooks/webhook-form";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<
    (Partial<WebhookFormData> & { id?: string }) | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/config");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Webhook[] = await res.json();
      const filtered = search
        ? data.filter((w) =>
            w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.sourceLabel?.toLowerCase().includes(search.toLowerCase())
          )
        : data;
      setWebhooks(filtered);
    } catch {
      console.error("Failed to fetch webhooks");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = () => {
    setEditTarget(undefined);
    setFormOpen(true);
  };

  const handleEdit = (wh: Webhook) => {
    setEditTarget({
      id: wh.id,
      name: wh.name,
      type: wh.type,
      sourceLabel: wh.sourceLabel ?? "",
      active: wh.isActive,
      campaignId: wh.campaignId ?? "",
      sequenceId: wh.sequenceId ?? "",
      verifyToken: wh.verifyToken ?? "",
      pageAccessToken: "",
      fieldMapping: wh.fieldMapping ?? {},
    });
    setFormOpen(true);
  };

  const handleSubmit = async (data: WebhookFormData) => {
    setFormLoading(true);
    try {
      const isEdit = !!editTarget?.id;
      const url = isEdit
        ? `/api/webhooks/config/${editTarget!.id}`
        : "/api/webhooks/config";
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
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save webhook");
      }
      toast.success(isEdit ? "Webhook updated" : "Webhook created");
      setFormOpen(false);
      fetchWebhooks();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save webhook"
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isActive } : w))
      );
      toast.success(isActive ? "Webhook activated" : "Webhook deactivated");
    } catch {
      toast.error("Failed to toggle webhook");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/webhooks/config/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete webhook");
      }
      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete webhook"
      );
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
          <p className="text-muted-foreground mt-1">
            Manage inbound webhooks to receive leads from external sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setInfoOpen(true)} title="Setup instructions">
            <Info className="h-4 w-4" />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search webhooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading webhooks...
        </div>
      ) : !webhooks.length ? (
        <div className="text-center py-12">
          <WebhookIcon className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">No webhooks configured.</p>
          <Button variant="outline" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first webhook
          </Button>
        </div>
      ) : (
        <WebhookList
          webhooks={webhooks}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onToggle={handleToggle}
        />
      )}

      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editTarget}
        loading={formLoading}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will stop receiving leads from this webhook. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
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

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to set up webhooks</DialogTitle>
            <DialogDescription>
              Follow the instructions below for your webhook type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div>
              <h4 className="font-semibold mb-2">For Zapier:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create a webhook here with type &quot;Zapier&quot;</li>
                <li>Copy the webhook URL</li>
                <li>In Zapier, create a new Zap with &quot;Webhooks by Zapier&quot; as the action</li>
                <li>Paste the webhook URL as the destination</li>
                <li>Map your form fields to the webhook payload (email, first_name, last_name, phone)</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">For Facebook Lead Ads:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create a webhook here with type &quot;Facebook Lead Ads&quot;</li>
                <li>Enter your Page Access Token</li>
                <li>Copy the webhook URL and Verify Token</li>
                <li>In Meta Business Manager, go to Business Settings &rarr; Integrations &rarr; Leads Access</li>
                <li>Set Callback URL = your webhook URL</li>
                <li>Set Verify Token = the token shown in the webhook config</li>
                <li>Subscribe to the &quot;leadgen&quot; field</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">For Generic webhooks:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create a webhook with type &quot;Generic&quot;</li>
                <li>Copy the webhook URL</li>
                <li>Send POST requests with JSON body containing lead fields</li>
                <li>Configure field mapping if your field names differ from standard (email, phone, first_name, last_name)</li>
              </ol>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium mb-1">Webhook URL format:</p>
              <code className="text-xs font-mono">
                https://ag2.q37fh758g.click/api/webhooks/inbound/&#123;slug&#125;
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Each webhook gets a unique URL. Leads received through each webhook are tagged with the webhook&apos;s source label for tracking.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
