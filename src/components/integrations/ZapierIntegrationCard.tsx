"use client";

import { useState, useEffect } from "react";
import { Zap, Copy, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "./ConnectionStatus";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function ZapierIntegrationCard() {
  const [copied, setCopied] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/zapier-leads`;

  useEffect(() => {
    fetch("/api/zapier-configs")
      .then((r) => (r.ok ? r.json() : []))
      .then((configs: { isActive: boolean }[]) => {
        if (Array.isArray(configs)) {
          setTotalCount(configs.length);
          setActiveCount(configs.filter((c) => c.isActive).length);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Zapier Lead Intake</CardTitle>
            <CardDescription className="text-xs">
              Receive leads from Zapier via Meta Campaign IDs
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status="connected" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Webhook URL</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Required Fields</Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">campaign_id</Badge>
              <span className="text-muted-foreground">Meta Campaign ID</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">email</Badge>
              <span className="text-muted-foreground">Lead email address</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">first_name</Badge>
              <span className="text-muted-foreground">Lead first name</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">phone</Badge>
              <span className="text-muted-foreground">Lead phone number</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-2 text-center">
            <p className="text-lg font-semibold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Configs</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-lg font-semibold">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total Configs</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Configure per-campaign Zapier settings on each campaign&apos;s detail page.
        </p>
      </CardContent>
    </Card>
  );
}
