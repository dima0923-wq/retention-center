"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelSelector } from "@/components/campaigns/ChannelSelector";
import { StepEditor, type StepData, type VapiConfig } from "@/components/sequences/StepEditor";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { toast } from "sonner";

type Script = { id: string; name: string; type: string };

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual enrollment" },
  { value: "new_lead", label: "When a new lead arrives" },
  { value: "no_conversion", label: "When lead has no conversion" },
];

export default function EditSequencePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [channels, setChannels] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [seqRes, scriptsRes] = await Promise.all([
        fetch(`/api/sequences/${id}`),
        fetch("/api/scripts"),
      ]);

      if (!seqRes.ok) throw new Error("Not found");
      const seq = await seqRes.json();
      const scriptData = await scriptsRes.json();

      setName(seq.name);
      setDescription(seq.description || "");
      setTriggerType(seq.triggerType);
      try {
        setChannels(JSON.parse(seq.channels));
      } catch {
        setChannels([]);
      }
      setSteps(
        (seq.steps || []).map((s: any) => {
          let vapiConfig: VapiConfig | undefined;
          try {
            const cond = typeof s.conditions === "string" ? JSON.parse(s.conditions) : (s.conditions ?? {});
            if (cond.vapiConfig) vapiConfig = cond.vapiConfig;
          } catch {}
          return {
            id: s.id,
            tempId: s.id,
            stepOrder: s.stepOrder,
            channel: s.channel,
            scriptId: s.scriptId || "",
            delayValue: s.delayValue,
            delayUnit: s.delayUnit,
            isActive: s.isActive,
            vapiConfig,
          };
        })
      );
      setScripts(Array.isArray(scriptData) ? scriptData : []);
    } catch {
      toast.error("Failed to load sequence");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        stepOrder: prev.length + 1,
        channel: channels[0] || "EMAIL",
        scriptId: "",
        delayValue: prev.length === 0 ? 0 : 24,
        delayUnit: "HOURS",
        isActive: true,
      },
    ]);
  };

  const updateStep = (index: number, updated: StepData) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        triggerType,
        channels: JSON.stringify(channels),
        steps: steps.map((s) => ({
          id: s.id || undefined,
          stepOrder: s.stepOrder,
          channel: s.channel,
          scriptId: s.scriptId || null,
          delayValue: s.delayValue,
          delayUnit: s.delayUnit,
          isActive: s.isActive,
          conditions: s.channel === "CALL" && s.vapiConfig
            ? { vapiConfig: s.vapiConfig }
            : undefined,
        })),
      };

      const res = await fetch(`/api/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }

      toast.success("Sequence updated");
      router.push(`/sequences/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save sequence");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading sequence...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/sequences/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Edit Sequence</h2>
            <p className="text-muted-foreground mt-1">{name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Sequence Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger Type</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <ChannelSelector value={channels} onChange={setChannels} />
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((s, idx) => (
            <StepEditor
              key={s.tempId}
              step={s}
              index={idx}
              scripts={scripts}
              onChange={(updated) => updateStep(idx, updated)}
              onRemove={() => removeStep(idx)}
            />
          ))}

          <Button variant="outline" onClick={addStep} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Step
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
