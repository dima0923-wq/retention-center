"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  MessageSquare,
  Mail,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type VapiConfig = {
  assistantId?: string;
  phoneNumberId?: string;
  voice?: string;
  model?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
};

export type StepData = {
  id?: string;
  tempId: string;
  stepOrder: number;
  channel: string;
  scriptId: string;
  delayValue: number;
  delayUnit: string;
  isActive: boolean;
  vapiConfig?: VapiConfig;
};

type Script = {
  id: string;
  name: string;
  type: string;
};

type VapiAssistant = {
  id: string;
  name: string;
  model?: string | null;
  modelProvider?: string | null;
  voiceProvider?: string | null;
  voiceId?: string | null;
};

type VapiPhoneNumber = {
  id: string;
  number: string;
  name: string;
  provider: string;
};

type VapiVoice = {
  id: string;
  name: string;
  provider: string;
};

type StepEditorProps = {
  step: StepData;
  index: number;
  scripts: Script[];
  onChange: (step: StepData) => void;
  onRemove: () => void;
};

const CHANNELS = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "SMS", label: "SMS", icon: MessageSquare },
  { value: "CALL", label: "Call", icon: Phone },
];

const DELAY_UNITS = [
  { value: "HOURS", label: "Hours" },
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
];

const VAPI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
];

export function StepEditor({ step, index, scripts, onChange, onRemove }: StepEditorProps) {
  const filteredScripts = scripts.filter((s) => s.type === step.channel);
  const isCall = step.channel === "CALL";

  const [showVapiConfig, setShowVapiConfig] = useState(false);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [voices, setVoices] = useState<VapiVoice[]>([]);
  const [loadingVapi, setLoadingVapi] = useState(false);
  const [vapiError, setVapiError] = useState<string | null>(null);

  // Fetch VAPI resources when CALL channel is selected and config panel is opened
  useEffect(() => {
    if (!isCall || !showVapiConfig) return;
    if (assistants.length > 0) return; // Already loaded

    setLoadingVapi(true);
    setVapiError(null);

    Promise.all([
      fetch("/api/integrations/vapi/assistants").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/integrations/vapi/phone-numbers").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/integrations/vapi/voices").then((r) => r.json()).catch(() => []),
    ])
      .then(([assistantsRes, phonesRes, voicesRes]) => {
        setAssistants(assistantsRes.data ?? []);
        setPhoneNumbers(phonesRes.data ?? []);
        setVoices(Array.isArray(voicesRes) ? voicesRes : voicesRes.data ?? []);
      })
      .catch(() => {
        setVapiError("Failed to load VAPI resources");
      })
      .finally(() => setLoadingVapi(false));
  }, [isCall, showVapiConfig, assistants.length]);

  // Auto-expand VAPI config if step already has config
  useEffect(() => {
    if (isCall && step.vapiConfig && Object.keys(step.vapiConfig).length > 0) {
      setShowVapiConfig(true);
    }
  }, [isCall, step.vapiConfig]);

  const updateVapiConfig = (key: keyof VapiConfig, value: string | number | undefined) => {
    const current = step.vapiConfig ?? {};
    const updated = { ...current, [key]: value || undefined };
    // Clean up undefined values
    for (const k of Object.keys(updated) as (keyof VapiConfig)[]) {
      if (updated[k] === undefined || updated[k] === "") delete updated[k];
    }
    onChange({ ...step, vapiConfig: Object.keys(updated).length > 0 ? updated : undefined });
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-4",
        !step.isActive && "opacity-60"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <span className="text-sm font-medium">Step {index + 1}</span>
          {isCall && step.vapiConfig?.assistantId && (
            <span className="text-xs text-muted-foreground bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              VAPI
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Channel */}
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select
            value={step.channel}
            onValueChange={(val) =>
              onChange({ ...step, channel: val, scriptId: "", vapiConfig: undefined })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((ch) => (
                <SelectItem key={ch.value} value={ch.value}>
                  <span className="flex items-center gap-2">
                    <ch.icon className="h-4 w-4" />
                    {ch.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Script */}
        <div className="space-y-2">
          <Label>Script / Template</Label>
          <Select
            value={step.scriptId}
            onValueChange={(val) => onChange({ ...step, scriptId: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select script" />
            </SelectTrigger>
            <SelectContent>
              {filteredScripts.length === 0 ? (
                <SelectItem value="none" disabled>
                  No scripts for this channel
                </SelectItem>
              ) : (
                filteredScripts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Delay */}
        <div className="space-y-2">
          <Label>Delay</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={step.delayValue}
              onChange={(e) =>
                onChange({ ...step, delayValue: parseInt(e.target.value) || 0 })
              }
              className="w-24"
            />
            <Select
              value={step.delayUnit}
              onValueChange={(val) => onChange({ ...step, delayUnit: val })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELAY_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* VAPI Configuration (CALL channel only) */}
      {isCall && (
        <div className="border-t pt-3 space-y-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            onClick={() => setShowVapiConfig(!showVapiConfig)}
          >
            <Settings2 className="h-4 w-4" />
            VAPI Call Configuration
            {showVapiConfig ? (
              <ChevronUp className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-auto" />
            )}
          </button>

          {showVapiConfig && (
            <div className="space-y-4 pl-1">
              {loadingVapi && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading VAPI resources...
                </div>
              )}

              {vapiError && (
                <p className="text-sm text-destructive">{vapiError}</p>
              )}

              {!loadingVapi && !vapiError && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Assistant */}
                    <div className="space-y-2">
                      <Label>Assistant</Label>
                      <Select
                        value={step.vapiConfig?.assistantId ?? ""}
                        onValueChange={(val) =>
                          updateVapiConfig("assistantId", val === "_none" ? undefined : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assistant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None (use default)</SelectItem>
                          {assistants.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                              {a.model && (
                                <span className="text-muted-foreground ml-1">({a.model})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Select
                        value={step.vapiConfig?.phoneNumberId ?? ""}
                        onValueChange={(val) =>
                          updateVapiConfig("phoneNumberId", val === "_none" ? undefined : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select phone number" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None (use default)</SelectItem>
                          {phoneNumbers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name !== p.number ? `${p.name} (${p.number})` : p.number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Voice */}
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <Select
                        value={step.vapiConfig?.voice ?? ""}
                        onValueChange={(val) =>
                          updateVapiConfig("voice", val === "_none" ? undefined : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None (use default)</SelectItem>
                          {voices.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                              <span className="text-muted-foreground ml-1">({v.provider})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Model */}
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select
                        value={step.vapiConfig?.model ?? ""}
                        onValueChange={(val) =>
                          updateVapiConfig("model", val === "_none" ? undefined : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None (use default)</SelectItem>
                          {VAPI_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* First Message */}
                  <div className="space-y-2">
                    <Label>First Message</Label>
                    <Input
                      placeholder="e.g., Hello {{name}}, this is a call regarding..."
                      value={step.vapiConfig?.firstMessage ?? ""}
                      onChange={(e) => updateVapiConfig("firstMessage", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The first thing the assistant says when the call connects.
                    </p>
                  </div>

                  {/* System Instructions */}
                  <div className="space-y-2">
                    <Label>System Instructions</Label>
                    <Textarea
                      placeholder="Instructions for the AI assistant during the call..."
                      value={step.vapiConfig?.instructions ?? ""}
                      onChange={(e) => updateVapiConfig("instructions", e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <span className="text-xs text-muted-foreground">
                        {step.vapiConfig?.temperature ?? 0.7}
                      </span>
                    </div>
                    <Input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={step.vapiConfig?.temperature ?? 0.7}
                      onChange={(e) => updateVapiConfig("temperature", parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Precise (0)</span>
                      <span>Creative (2)</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
