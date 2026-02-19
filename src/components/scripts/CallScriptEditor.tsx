"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Phone } from "lucide-react";
import { toast } from "sonner";

type VapiConfig = {
  model?: string;
  voice?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
  assistantId?: string;
  phoneNumberId?: string;
  [key: string]: unknown;
};

type Props = {
  config: VapiConfig;
  onChange: (config: VapiConfig) => void;
};

type Assistant = { id: string; name: string };
type PhoneNumber = { id: string; number: string; provider: string };
type VoiceEntry = { id: string; name: string; provider: string };

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet" },
];

const FALLBACK_VOICES: VoiceEntry[] = [
  { id: "openai-alloy", name: "Alloy", provider: "openai" },
  { id: "openai-echo", name: "Echo", provider: "openai" },
  { id: "openai-fable", name: "Fable", provider: "openai" },
  { id: "openai-onyx", name: "Onyx", provider: "openai" },
  { id: "openai-nova", name: "Nova", provider: "openai" },
  { id: "openai-shimmer", name: "Shimmer", provider: "openai" },
];

export function CallScriptEditor({ config, onChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState(JSON.stringify(config, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [voices, setVoices] = useState<VoiceEntry[]>(FALLBACK_VOICES);

  const [testPhone, setTestPhone] = useState("");
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    setRawJson(JSON.stringify(config, null, 2));
  }, [config]);

  useEffect(() => {
    fetch("/api/integrations/vapi/assistants")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAssistants(data); })
      .catch(() => {});

    fetch("/api/integrations/vapi/phone-numbers")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPhoneNumbers(data); })
      .catch(() => {});

    fetch("/api/integrations/vapi/voices")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setVoices(data); })
      .catch(() => {});
  }, []);

  const updateField = (field: string, value: unknown) => {
    onChange({ ...config, [field]: value });
  };

  const handleRawJsonChange = (value: string) => {
    setRawJson(value);
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  const handleTestCall = async () => {
    if (!testPhone.trim()) {
      toast.error("Enter a phone number to call");
      return;
    }
    setIsCalling(true);
    try {
      const res = await fetch("/api/integrations/vapi/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: testPhone.trim(),
          assistantId: config.assistantId,
          phoneNumberId: config.phoneNumberId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Call failed: ${data.error ?? "Unknown error"}`);
      } else {
        toast.success(`Call initiated! ID: ${data.callId} — Status: ${data.status}`);
      }
    } catch {
      toast.error("Network error initiating call");
    } finally {
      setIsCalling(false);
    }
  };

  // Group voices by provider for display
  const voicesByProvider = voices.reduce<Record<string, VoiceEntry[]>>((acc, v) => {
    (acc[v.provider] ??= []).push(v);
    return acc;
  }, {});

  if (showRawJson) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Raw JSON Config</Label>
          <Button variant="outline" size="sm" onClick={() => setShowRawJson(false)}>
            Form View
          </Button>
        </div>
        <Textarea
          rows={16}
          value={rawJson}
          onChange={(e) => handleRawJsonChange(e.target.value)}
          className="font-mono text-sm"
        />
        {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRawJson(JSON.stringify(config, null, 2));
            setShowRawJson(true);
          }}
        >
          <Code className="h-4 w-4 mr-1" />
          Raw JSON
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">VAPI Assistant Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Assistant selector */}
          <div>
            <Label>Assistant</Label>
            <Select
              value={config.assistantId || "__default__"}
              onValueChange={(v) => updateField("assistantId", v === "__default__" ? undefined : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Use default from integration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use default from integration</SelectItem>
                {assistants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Number selector */}
          <div>
            <Label>Phone Number (caller)</Label>
            <Select
              value={config.phoneNumberId || "__default__"}
              onValueChange={(v) => updateField("phoneNumberId", v === "__default__" ? undefined : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Use default from integration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use default from integration</SelectItem>
                {phoneNumbers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.number} ({p.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Note: Free VAPI numbers cannot call international numbers. Use a Twilio number for international calls.
            </p>
          </div>

          {/* Model */}
          <div>
            <Label>Model</Label>
            <Select
              value={config.model ?? undefined}
              onValueChange={(v) => updateField("model", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice — grouped by provider */}
          <div>
            <Label>Voice</Label>
            <Select
              value={config.voice || undefined}
              onValueChange={(v) => updateField("voice", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(voicesByProvider).map(([provider, providerVoices]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="capitalize">{provider}</SelectLabel>
                    {providerVoices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First Message */}
          <div>
            <Label>First Message</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={config.firstMessage || ""}
              onChange={(e) => updateField("firstMessage", e.target.value)}
              placeholder="Hello! I'm calling from..."
            />
          </div>

          {/* System Instructions */}
          <div>
            <Label>System Instructions</Label>
            <Textarea
              className="mt-1"
              rows={6}
              value={config.instructions || ""}
              onChange={(e) => updateField("instructions", e.target.value)}
              placeholder="You are a sales representative calling..."
            />
          </div>

          {/* Temperature */}
          <div>
            <Label>Temperature: {config.temperature ?? 0.7}</Label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature ?? 0.7}
              onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
              className="mt-1 w-full"
            />
          </div>

          {/* Test Call */}
          <div className="border-t pt-4">
            <Label>Test Call</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleTestCall}
                disabled={isCalling}
              >
                <Phone className="h-4 w-4 mr-1" />
                {isCalling ? "Calling..." : "Test Call"}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
