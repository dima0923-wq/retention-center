"use client";

import { Phone, MessageSquare, Mail, Bell, Clock, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const channelConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
  CALL: { icon: Phone, label: "Call", color: "bg-orange-100 text-orange-700 border-orange-200" },
  SMS: { icon: MessageSquare, label: "SMS", color: "bg-blue-100 text-blue-700 border-blue-200" },
  EMAIL: { icon: Mail, label: "Email", color: "bg-green-100 text-green-700 border-green-200" },
  PUSH: { icon: Bell, label: "Push", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const delayUnitLabels: Record<string, string> = {
  HOURS: "h",
  DAYS: "d",
  WEEKS: "w",
};

type Step = {
  id: string;
  stepOrder: number;
  channel: string;
  scriptId?: string | null;
  script?: { name: string } | null;
  delayValue: number;
  delayUnit: string;
  isActive: boolean;
  conditions?: string | Record<string, unknown>;
  _count?: { executions: number };
  stats?: {
    sent: number;
    delivered: number;
    failed: number;
  };
};

type SequenceTimelineProps = {
  steps: Step[];
  showStats?: boolean;
};

export function SequenceTimeline({ steps, showStats = false }: SequenceTimelineProps) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No steps configured yet
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((step, idx) => {
        const config = channelConfig[step.channel] ?? {
          icon: Mail,
          label: step.channel,
          color: "bg-gray-100 text-gray-700 border-gray-200",
        };
        const Icon = config.icon;
        const unitLabel = delayUnitLabels[step.delayUnit] ?? step.delayUnit;

        // Parse VAPI config from conditions
        let vapiConfig: { assistantId?: string; phoneNumberId?: string; voice?: string; model?: string; firstMessage?: string } | null = null;
        if (step.channel === "CALL" && step.conditions) {
          try {
            const cond = typeof step.conditions === "string" ? JSON.parse(step.conditions) : step.conditions;
            if (cond?.vapiConfig) vapiConfig = cond.vapiConfig;
          } catch {}
        }

        return (
          <div key={step.id}>
            {/* Delay indicator */}
            {(idx > 0 || step.delayValue > 0) && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  <span>
                    {step.delayValue > 0
                      ? `Wait ${step.delayValue}${unitLabel}`
                      : "Immediately"}
                  </span>
                </div>
              </div>
            )}

            {/* Step card */}
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                !step.isActive && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                  config.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Step {step.stepOrder + 1}: {config.label}
                  </span>
                  {!step.isActive && (
                    <Badge variant="outline" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                  {vapiConfig?.assistantId && (
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      VAPI
                    </Badge>
                  )}
                </div>
                {step.script && (
                  <p className="text-xs text-muted-foreground truncate">
                    Script: {step.script.name}
                  </p>
                )}
                {vapiConfig && (vapiConfig.assistantId || vapiConfig.voice || vapiConfig.model) && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {vapiConfig.model && (
                      <span className="text-xs text-muted-foreground">Model: {vapiConfig.model}</span>
                    )}
                    {vapiConfig.voice && (
                      <span className="text-xs text-muted-foreground">Voice: {vapiConfig.voice}</span>
                    )}
                  </div>
                )}
              </div>
              {showStats && step.stats && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span>{step.stats.sent} sent</span>
                  <span className="text-green-600">{step.stats.delivered} delivered</span>
                  {step.stats.failed > 0 && (
                    <span className="text-red-600">{step.stats.failed} failed</span>
                  )}
                </div>
              )}
            </div>

            {/* Connector arrow */}
            {idx < sorted.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
