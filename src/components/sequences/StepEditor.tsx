"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, MessageSquare, Mail, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type StepData = {
  id?: string;
  tempId: string;
  stepOrder: number;
  channel: string;
  scriptId: string;
  delayValue: number;
  delayUnit: string;
  isActive: boolean;
};

type Script = {
  id: string;
  name: string;
  type: string;
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

export function StepEditor({ step, index, scripts, onChange, onRemove }: StepEditorProps) {
  const filteredScripts = scripts.filter(
    (s) => s.type === step.channel
  );

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
              onChange({ ...step, channel: val, scriptId: "" })
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
    </div>
  );
}
