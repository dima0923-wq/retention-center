"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DateRangePreset = "7d" | "30d" | "90d" | "custom";

type DateRangePickerProps = {
  selected: DateRangePreset;
  onSelect: (preset: DateRangePreset) => void;
};

const presets: { label: string; value: DateRangePreset }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

export function DateRangePicker({ selected, onSelect }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={selected === preset.value ? "default" : "outline"}
          size="sm"
          className={cn("text-xs")}
          onClick={() => onSelect(preset.value)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

export function getDateRange(preset: DateRangePreset) {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }

  return { from, to };
}
