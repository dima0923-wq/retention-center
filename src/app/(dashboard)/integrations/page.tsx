"use client";

import { Phone, Globe } from "lucide-react";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { SmsIntegrationCard } from "@/components/integrations/SmsIntegrationCard";
import { InstantlyIntegrationCard } from "@/components/integrations/InstantlyIntegrationCard";
import { KeitaroIntegrationCard } from "@/components/integrations/KeitaroIntegrationCard";
import { WebhookUrlDisplay } from "@/components/integrations/WebhookUrlDisplay";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectionStatus } from "@/components/integrations/ConnectionStatus";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export default function IntegrationsPage() {
  const baseUrl = getBaseUrl();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Configure SMS, email, and voice channel integrations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IntegrationCard
          provider="vapi"
          type="CALL"
          title="VAPI AI"
          description="AI-powered voice calls for lead outreach"
          icon={<Phone className="h-5 w-5" />}
          fields={[
            {
              key: "apiKey",
              label: "API Key",
              type: "password",
              placeholder: "sk-...",
            },
            {
              key: "baseUrl",
              label: "Base URL (optional)",
              placeholder: "https://api.vapi.ai",
            },
            {
              key: "assistantId",
              label: "Assistant ID",
              placeholder: "Your VAPI assistant ID",
            },
          ]}
          webhookUrl={`${baseUrl}/api/webhooks/vapi`}
        />

        <SmsIntegrationCard />

        <InstantlyIntegrationCard />

        <KeitaroIntegrationCard />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Meta Webhooks</CardTitle>
                <CardDescription className="text-xs">
                  Receive leads from Meta Lead Ads forms
                </CardDescription>
              </div>
            </div>
            <ConnectionStatus status="connected" />
          </CardHeader>
          <CardContent className="space-y-4">
            <WebhookUrlDisplay
              label="Webhook Callback URL"
              url={`${baseUrl}/api/webhooks/meta`}
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Verification Token
              </p>
              <code className="block rounded bg-muted px-3 py-2 text-xs font-mono">
                {process.env.NEXT_PUBLIC_META_VERIFY_TOKEN ?? "Set META_WEBHOOK_VERIFY_TOKEN in .env"}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure this URL in your Meta App Dashboard under Webhooks.
              Subscribe to the &quot;leadgen&quot; field on your Page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
