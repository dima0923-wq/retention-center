"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Loader2,
  Zap,
} from "lucide-react";

type ChannelConfig = {
  sms?: { enabled: boolean; scriptId?: string };
  email?: { enabled: boolean; scriptId?: string };
  call?: { enabled: boolean; scriptId?: string };
};

type ZapierConfig = {
  id: string;
  campaignId: string;
  metaCampaignId: string;
  metaAdsetId?: string | null;
  metaFormId?: string | null;
  isActive: boolean;
  channelConfig: string;
  autoEnrollSequenceId?: string | null;
  createdAt: string;
  sequence?: { id: string; name: string; status: string } | null;
};

type Script = { id: string; name: string; type: string };
type Sequence = { id: string; name: string; status: string };

type FormState = {
  metaCampaignId: string;
  metaAdsetId: string;
  metaFormId: string;
  isActive: boolean;
  channelConfig: ChannelConfig;
  autoEnrollSequenceId: string;
};

const emptyForm: FormState = {
  metaCampaignId: "",
  metaAdsetId: "",
  metaFormId: "",
  isActive: true,
  channelConfig: {},
  autoEnrollSequenceId: "",
};

export function ZapierConfigCard({ campaignId }: { campaignId: string }) {
  const [configs, setConfigs] = useState<ZapierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [scripts, setScripts] = useState<{ SMS: Script[]; EMAIL: Script[]; CALL: Script[] }>({
    SMS: [],
    EMAIL: [],
    CALL: [],
  });
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/zapier-leads`
      : "/api/webhooks/zapier-leads";

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch(`/api/zapier-configs/by-campaign/${campaignId}`);
      if (res.ok) setConfigs(await res.json());
    } catch {
      console.error("Failed to fetch zapier configs");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const fetchOptions = useCallback(async () => {
    try {
      const [smsRes, emailRes, callRes, seqRes] = await Promise.all([
        fetch("/api/scripts?type=SMS"),
        fetch("/api/scripts?type=EMAIL"),
        fetch("/api/scripts?type=CALL"),
        fetch("/api/sequences?status=ACTIVE"),
      ]);
      const [sms, email, call, seqData] = await Promise.all([
        smsRes.ok ? smsRes.json() : [],
        emailRes.ok ? emailRes.json() : [],
        callRes.ok ? callRes.json() : [],
        seqRes.ok ? seqRes.json() : [],
      ]);
      setScripts({ SMS: sms, EMAIL: email, CALL: call });
      const seqList = Array.isArray(seqData) ? seqData : seqData.data ?? [];
      setSequences(seqList);
    } catch {
      console.error("Failed to fetch scripts/sequences");
    }
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    fetchOptions();
    setDialogOpen(true);
  };

  const openEdit = (config: ZapierConfig) => {
    setEditingId(config.id);
    const cc = parseChannelConfig(config.channelConfig);
    setForm({
      metaCampaignId: config.metaCampaignId,
      metaAdsetId: config.metaAdsetId ?? "",
      metaFormId: config.metaFormId ?? "",
      isActive: config.isActive,
      channelConfig: cc,
      autoEnrollSequenceId: config.autoEnrollSequenceId ?? "",
    });
    fetchOptions();
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Zapier config?")) return;
    try {
      const res = await fetch(`/api/zapier-configs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Config deleted");
      fetchConfigs();
    } catch {
      toast.error("Failed to delete config");
    }
  };

  const handleSave = async () => {
    if (!form.metaCampaignId.trim()) {
      toast.error("Meta Campaign ID is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        campaignId,
        metaCampaignId: form.metaCampaignId.trim(),
        metaAdsetId: form.metaAdsetId.trim() || null,
        metaFormId: form.metaFormId.trim() || null,
        isActive: form.isActive,
        channelConfig: form.channelConfig,
        autoEnrollSequenceId: form.autoEnrollSequenceId || null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/zapier-configs/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/zapier-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      toast.success(editingId ? "Config updated" : "Config created");
      setDialogOpen(false);
      fetchConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateChannel = (
    channel: "sms" | "email" | "call",
    field: "enabled" | "scriptId",
    value: boolean | string
  ) => {
    setForm((prev) => ({
      ...prev,
      channelConfig: {
        ...prev.channelConfig,
        [channel]: {
          ...prev.channelConfig[channel],
          [field]: value,
        },
      },
    }));
  };

  const enabledChannels = (config: ZapierConfig) => {
    const cc = parseChannelConfig(config.channelConfig);
    const channels: string[] = [];
    if (cc.sms?.enabled) channels.push("SMS");
    if (cc.email?.enabled) channels.push("Email");
    if (cc.call?.enabled) channels.push("Call");
    return channels;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading Zapier configs...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Zapier Lead Intake</CardTitle>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-3 w-3" />
            Add Config
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Webhook URL (paste into Zapier)
            </Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Config list */}
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No Zapier configs yet. Add one to start receiving leads from Zapier.
            </p>
          ) : (
            <div className="space-y-2">
              {configs.map((config) => {
                const channels = enabledChannels(config);
                return (
                  <div
                    key={config.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium font-mono">
                          {config.metaCampaignId}
                        </span>
                        <Badge
                          variant={config.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {config.metaAdsetId && (
                          <span>Adset: {config.metaAdsetId}</span>
                        )}
                        {channels.length > 0 && (
                          <span>Channels: {channels.join(", ")}</span>
                        )}
                        {config.sequence && (
                          <span>Sequence: {config.sequence.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Zapier Config" : "Add Zapier Config"}
            </DialogTitle>
            <DialogDescription>
              Configure how leads from a specific Meta campaign are processed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="metaCampaignId">Meta Campaign ID *</Label>
              <Input
                id="metaCampaignId"
                placeholder="e.g. 120212345678901234"
                value={form.metaCampaignId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metaCampaignId: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="metaAdsetId">Meta Adset ID</Label>
                <Input
                  id="metaAdsetId"
                  placeholder="Optional"
                  value={form.metaAdsetId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metaAdsetId: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaFormId">Form ID</Label>
                <Input
                  id="metaFormId"
                  placeholder="Optional"
                  value={form.metaFormId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metaFormId: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Channel toggles */}
            <div className="space-y-3">
              <Label>Channels</Label>

              {(["sms", "email", "call"] as const).map((ch) => {
                const label = ch.toUpperCase();
                const chConfig = form.channelConfig[ch];
                const enabled = chConfig?.enabled ?? false;
                const scriptType = ch.toUpperCase() as "SMS" | "EMAIL" | "CALL";
                const availableScripts = scripts[scriptType];

                return (
                  <div key={ch} className="rounded-md border p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          updateChannel(ch, "enabled", e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                    {enabled && availableScripts.length > 0 && (
                      <div className="pl-6">
                        <Label className="text-xs text-muted-foreground">
                          Script
                        </Label>
                        <Select
                          value={chConfig?.scriptId ?? "__none__"}
                          onValueChange={(v) =>
                            updateChannel(
                              ch,
                              "scriptId",
                              v === "__none__" ? "" : v
                            )
                          }
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select script" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No script</SelectItem>
                            {availableScripts.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sequence selector */}
            <div className="space-y-2">
              <Label>Auto-enroll Sequence</Label>
              <Select
                value={form.autoEnrollSequenceId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    autoEnrollSequenceId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No sequence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No sequence</SelectItem>
                  {sequences.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parseChannelConfig(raw: string): ChannelConfig {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
