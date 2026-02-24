"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { SequenceTimeline } from "@/components/sequences/SequenceTimeline";
import { ArrowLeft, ArrowRight, Plus, Check } from "lucide-react";
import { toast } from "sonner";

type Script = { id: string; name: string; type: string };

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual enrollment" },
  { value: "new_lead", label: "When a new lead arrives" },
  { value: "no_conversion", label: "When lead has no conversion" },
];

export default function NewSequencePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [channels, setChannels] = useState<string[]>([]);

  // Step 2 fields
  const [steps, setSteps] = useState<StepData[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => setScripts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

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

  const canProceedStep1 = name.trim().length > 0 && channels.length > 0;
  const canProceedStep2 = steps.length > 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        triggerType,
        channels: JSON.stringify(channels),
        steps: steps.map((s) => ({
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

      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create sequence");
      }

      const data = await res.json();
      toast.success("Sequence created");
      router.push(`/sequences/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sequence");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/sequences")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Sequence</h2>
          <p className="text-muted-foreground mt-1">
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                placeholder="e.g., New Lead Follow-up"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this sequence does..."
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

            <div className="flex justify-end">
              <Button disabled={!canProceedStep1} onClick={() => setStep(2)}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Build steps */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Build Steps</CardTitle>
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

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button disabled={!canProceedStep2} onClick={() => setStep(3)}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Sequence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="text-sm font-medium">{name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Trigger</Label>
                  <p className="text-sm font-medium">
                    {TRIGGER_TYPES.find((t) => t.value === triggerType)?.label}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Channels</Label>
                  <p className="text-sm font-medium">{channels.join(", ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Steps</Label>
                  <p className="text-sm font-medium">{steps.length}</p>
                </div>
              </div>
              {description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sequence Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <SequenceTimeline
                steps={steps.map((s) => ({
                  id: s.tempId,
                  stepOrder: s.stepOrder,
                  channel: s.channel,
                  scriptId: s.scriptId || null,
                  script: scripts.find((sc) => sc.id === s.scriptId)
                    ? { name: scripts.find((sc) => sc.id === s.scriptId)!.name }
                    : null,
                  delayValue: s.delayValue,
                  delayUnit: s.delayUnit,
                  isActive: s.isActive,
                  conditions: s.channel === "CALL" && s.vapiConfig
                    ? { vapiConfig: s.vapiConfig }
                    : undefined,
                }))}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              <Check className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Sequence"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
