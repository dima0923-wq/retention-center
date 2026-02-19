"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code } from "lucide-react";

type VapiConfig = {
  model?: string;
  voice?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
  [key: string]: unknown;
};

type Props = {
  config: VapiConfig;
  onChange: (config: VapiConfig) => void;
};

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet" },
];

const VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
];

export function CallScriptEditor({ config, onChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState(JSON.stringify(config, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

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
          <div>
            <Label>Model</Label>
            <Select
              value={config.model || ""}
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

          <div>
            <Label>Voice</Label>
            <Select
              value={config.voice || ""}
              onValueChange={(v) => updateField("voice", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
        </CardContent>
      </Card>
    </div>
  );
}
