"use client";

import { Phone, MessageSquare, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { value: "CALL", label: "Call", icon: Phone },
  { value: "SMS", label: "SMS", icon: MessageSquare },
  { value: "EMAIL", label: "Email", icon: Mail },
] as const;

type ChannelSelectorProps = {
  value: string[];
  onChange: (channels: string[]) => void;
};

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  const toggle = (channel: string) => {
    if (value.includes(channel)) {
      onChange(value.filter((c) => c !== channel));
    } else {
      onChange([...value, channel]);
    }
  };

  return (
    <div className="flex gap-3">
      {CHANNELS.map(({ value: ch, label, icon: Icon }) => {
        const selected = value.includes(ch);
        return (
          <button
            key={ch}
            type="button"
            onClick={() => toggle(ch)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ChannelIcons({ channels }: { channels: string[] }) {
  return (
    <div className="flex gap-1.5">
      {channels.map((ch) => {
        const config = CHANNELS.find((c) => c.value === ch);
        if (!config) return null;
        const Icon = config.icon;
        return (
          <div
            key={ch}
            title={config.label}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-muted"
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        );
      })}
    </div>
  );
}
