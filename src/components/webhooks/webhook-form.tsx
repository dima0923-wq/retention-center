"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Campaign = { id: string; name: string };
type Sequence = { id: string; name: string };

export type WebhookFormData = {
  name: string;
  type: string;
  sourceLabel: string;
  active: boolean;
  campaignId: string;
  sequenceId: string;
  verifyToken: string;
  pageAccessToken: string;
  fieldMapping: Record<string, string>;
};

const LEAD_FIELDS = ["firstName", "lastName", "email", "phone"];

const PRESET_MAPPINGS: Record<string, Record<string, string>> = {
  facebook: {
    first_name: "firstName",
    last_name: "lastName",
    email: "email",
    phone_number: "phone",
  },
  zapier: {
    first_name: "firstName",
    last_name: "lastName",
    email: "email",
    phone: "phone",
  },
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WebhookFormData) => void;
  initialData?: Partial<WebhookFormData> & { id?: string };
  loading?: boolean;
}) {
  const isEdit = !!initialData?.id;

  const [name, setName] = useState("");
  const [type, setType] = useState("generic");
  const [sourceLabel, setSourceLabel] = useState("");
  const [active, setActive] = useState(true);
  const [campaignId, setCampaignId] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [fieldMapping, setFieldMapping] = useState<[string, string][]>([]);
  const [copiedToken, setCopiedToken] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/campaigns?pageSize=100")
        .then((r) => r.json())
        .then((d) => setCampaigns(d.data ?? []))
        .catch(() => {});
      fetch("/api/sequences?pageSize=100")
        .then((r) => r.json())
        .then((d) => setSequences(d.data ?? []))
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name ?? "");
      setType(initialData.type ?? "generic");
      setSourceLabel(initialData.sourceLabel ?? "");
      setActive(initialData.active ?? true);
      setCampaignId(initialData.campaignId ?? "");
      setSequenceId(initialData.sequenceId ?? "");
      setVerifyToken(initialData.verifyToken ?? generateToken());
      setPageAccessToken(initialData.pageAccessToken ?? "");
      const mapping = initialData.fieldMapping ?? {};
      setFieldMapping(Object.entries(mapping));
    } else if (open) {
      setName("");
      setType("generic");
      setSourceLabel("");
      setActive(true);
      setCampaignId("");
      setSequenceId("");
      setVerifyToken(generateToken());
      setPageAccessToken("");
      setFieldMapping([]);
    }
  }, [open, initialData]);

  const handleCopyToken = async () => {
    await navigator.clipboard.writeText(verifyToken);
    setCopiedToken(true);
    toast.success("Verify token copied");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const addMapping = () => {
    setFieldMapping((prev) => [...prev, ["", ""]]);
  };

  const removeMapping = (index: number) => {
    setFieldMapping((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, key: string, value: string) => {
    setFieldMapping((prev) =>
      prev.map((pair, i) => (i === index ? [key, value] : pair))
    );
  };

  const applyPreset = (preset: string) => {
    const mapping = PRESET_MAPPINGS[preset];
    if (mapping) {
      setFieldMapping(Object.entries(mapping));
      toast.success(`Applied ${preset} preset`);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const mappingObj: Record<string, string> = {};
    for (const [k, v] of fieldMapping) {
      if (k.trim() && v.trim()) {
        mappingObj[k.trim()] = v.trim();
      }
    }
    onSubmit({
      name: name.trim(),
      type,
      sourceLabel: sourceLabel.trim(),
      active,
      campaignId,
      sequenceId,
      verifyToken: type === "facebook" ? verifyToken : "",
      pageAccessToken: type === "facebook" ? pageAccessToken : "",
      fieldMapping: mappingObj,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update webhook configuration."
              : "Set up a new inbound webhook to receive leads."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wh-name">Name</Label>
            <Input
              id="wh-name"
              placeholder="e.g. Zapier IT Leads"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">Generic</SelectItem>
                <SelectItem value="zapier">Zapier</SelectItem>
                <SelectItem value="facebook">Facebook Lead Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-source">Source Label</Label>
            <Input
              id="wh-source"
              placeholder="e.g. ZAPIER_IT_LEADS"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Appears on leads received through this webhook.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign (optional)</Label>
              <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sequence (optional)</Label>
              <Select value={sequenceId || "none"} onValueChange={(v) => setSequenceId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sequences.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="wh-active">Active</Label>
            <Switch
              id="wh-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          {type === "facebook" && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Facebook Settings</p>
              <div className="space-y-2">
                <Label className="text-xs">Verify Token</Label>
                <div className="flex gap-2">
                  <Input
                    value={verifyToken}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                  >
                    {copiedToken ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs" htmlFor="wh-pat">
                  Page Access Token
                </Label>
                <Input
                  id="wh-pat"
                  type="password"
                  placeholder="Paste your Page Access Token"
                  value={pageAccessToken}
                  onChange={(e) => setPageAccessToken(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Field Mapping</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("facebook")}
                >
                  Facebook Preset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("zapier")}
                >
                  Zapier Preset
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Map incoming field names to lead fields.
            </p>
            {fieldMapping.map(([key, val], i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Incoming field"
                  value={key}
                  onChange={(e) => updateMapping(i, e.target.value, val)}
                  className="text-sm"
                />
                <span className="text-muted-foreground text-sm shrink-0">
                  &rarr;
                </span>
                <Select
                  value={val}
                  onValueChange={(v) => updateMapping(i, key, v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Lead field" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeMapping(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="mr-1 h-3 w-3" />
              Add Mapping
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
