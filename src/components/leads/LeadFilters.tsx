"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
  { value: "DO_NOT_CONTACT", label: "Do Not Contact" },
];

const SOURCES = [
  { value: "META", label: "Meta" },
  { value: "MANUAL", label: "Manual" },
  { value: "API", label: "API" },
];

export function LeadFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1");
      router.push(`/leads?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/leads");
  }, [router]);

  const hasFilters =
    searchParams.has("search") ||
    searchParams.has("status") ||
    searchParams.has("source") ||
    searchParams.has("dateFrom") ||
    searchParams.has("dateTo");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search by name, email, phone..."
        className="w-64"
        defaultValue={searchParams.get("search") || ""}
        onChange={(e) => {
          const value = e.target.value;
          // Debounce search
          const timeout = setTimeout(() => updateFilter("search", value || null), 300);
          return () => clearTimeout(timeout);
        }}
      />

      <Select
        value={searchParams.get("status") || ""}
        onValueChange={(value) => updateFilter("status", value || null)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("source") || ""}
        onValueChange={(value) => updateFilter("source", value || null)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          {SOURCES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-36"
        defaultValue={searchParams.get("dateFrom") || ""}
        onChange={(e) => updateFilter("dateFrom", e.target.value || null)}
        placeholder="From"
      />

      <Input
        type="date"
        className="w-36"
        defaultValue={searchParams.get("dateTo") || ""}
        onChange={(e) => updateFilter("dateTo", e.target.value || null)}
        placeholder="To"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
