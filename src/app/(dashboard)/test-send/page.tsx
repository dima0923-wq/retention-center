"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Phone, RefreshCw } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplateVariableInserter } from "@/components/scripts/TemplateVariableInserter";
import { useVapiResources } from "@/hooks/use-vapi-resources";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = { id: string; name: string; status?: number };

// ─── Email Tab ────────────────────────────────────────────────────────────────

function EmailTab({ campaigns }: { campaigns: Campaign[] }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [campaignId, setCampaignId] = useState("__none__");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  async function handleSend() {
    if (!to || !subject || !body) {
      toast.error("Please fill in To, Subject, and Body.");
      return;
    }
    if (campaignId === "__none__") {
      toast.error("Please select an Instantly campaign.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/test-send/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      toast.success("Lead added to campaign. Email will be sent per campaign schedule.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send Test Email</CardTitle>
        <CardDescription>
          Send a one-off test email via Instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email-to">To</Label>
          <Input
            id="email-to"
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-body">Body</Label>
            <TemplateVariableInserter onInsert={insertVariable} />
          </div>
          <Textarea
            id="email-body"
            ref={bodyRef}
            placeholder="Email body — supports {{firstName}}, {{lastName}}, etc."
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Instantly Campaign</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select a campaign...</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.status === 1 ? "(Active)" : c.status === 3 ? "(Completed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campaigns.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No campaigns found. Create a campaign in Instantly first.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The lead will be added to this campaign and emailed per the campaign schedule.
            Make sure the campaign is Active for immediate sending.
          </p>
        </div>

        <Button onClick={handleSend} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send Email
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Postmark Email Tab ──────────────────────────────────────────────────────

type EmailTemplateOption = {
  id: string;
  name: string;
  subject: string;
  fromEmail: string;
  fromName: string;
};

function PostmarkEmailTab() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("__none__");
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/email-templates?isActive=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmailTemplateOption[]) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    if (id === "__none__") return;
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
    }
  }

  function insertVariable(variable: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  async function handleSend() {
    if (!to) {
      toast.error("Please enter a recipient email.");
      return;
    }
    const useTemplate = templateId !== "__none__";
    if (!useTemplate && (!subject || !body)) {
      toast.error("Please fill in Subject and Body, or select a template.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = { to };
      if (useTemplate) {
        payload.templateId = templateId;
      } else {
        payload.subject = subject;
        payload.body = body;
      }
      const res = await fetch("/api/test-send/postmark-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      toast.success(
        useTemplate
          ? "Test email sent via Postmark using template."
          : "Test email sent via Postmark."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send Test Email via Postmark</CardTitle>
        <CardDescription>
          Send a one-off test email via Postmark. Optionally use an email template.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pm-email-to">To</Label>
          <Input
            id="pm-email-to"
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Email Template (optional)</Label>
          <Select
            value={templateId}
            onValueChange={handleTemplateChange}
            disabled={templatesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={templatesLoading ? "Loading..." : "Select template"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No template (manual)</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templates.length === 0 && !templatesLoading && (
            <p className="text-xs text-muted-foreground">
              No active templates found. Create one in Email Templates first.
            </p>
          )}
        </div>

        {templateId === "__none__" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pm-email-subject">Subject</Label>
              <Input
                id="pm-email-subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pm-email-body">Body (HTML)</Label>
                <TemplateVariableInserter onInsert={insertVariable} />
              </div>
              <Textarea
                id="pm-email-body"
                ref={bodyRef}
                placeholder="Email body — supports {{firstName}}, {{lastName}}, etc."
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </>
        )}

        <Button onClick={handleSend} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send via Postmark
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── SMS Tab ──────────────────────────────────────────────────────────────────

function SmsTab() {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState("sms-retail");
  const [loading, setLoading] = useState(false);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const el = msgRef.current;
    if (!el) {
      setMessage((prev) => prev + variable);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const newMsg = message.slice(0, start) + variable + message.slice(end);
    setMessage(newMsg);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  async function handleSend() {
    if (!to || !message) {
      toast.error("Please fill in To and Message.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/test-send/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send SMS");
      toast.success("SMS sent successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send Test SMS</CardTitle>
        <CardDescription>Send a one-off test SMS via SMS provider.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sms-to">To</Label>
          <Input
            id="sms-to"
            type="tel"
            placeholder="+1234567890"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-message">Message</Label>
            <TemplateVariableInserter onInsert={insertVariable} />
          </div>
          <Textarea
            id="sms-message"
            ref={msgRef}
            placeholder="SMS message — supports {{firstName}}, {{lastName}}, etc."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sms-retail">SMS Retail</SelectItem>
              <SelectItem value="23telecom">23Telecom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSend} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send SMS
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Call Tab ─────────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet" },
];

function CallTab() {
  const [to, setTo] = useState("");
  const [assistantId, setAssistantId] = useState("__none__");
  const [phoneNumberId, setPhoneNumberId] = useState("__none__");
  const [voiceId, setVoiceId] = useState("__none__");
  const [model, setModel] = useState("gpt-4o");
  const [firstMessage, setFirstMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);

  const { assistants, phoneNumbers, voices, loading: vapiLoading, error: vapiError, refresh: refreshVapi } = useVapiResources();
  const [extraVoice, setExtraVoice] = useState<{ id: string; name: string; provider: string } | null>(null);

  // Merge extra voice (from assistant) into voice list if not already present
  const allVoices = extraVoice && !voices.some((v) => v.id === extraVoice.id)
    ? [...voices, extraVoice]
    : voices;

  function handleAssistantChange(id: string) {
    setAssistantId(id);
    if (id === "__none__") return;
    const assistant = assistants.find((a) => a.id === id);
    if (!assistant) return;
    if (assistant.firstMessage) setFirstMessage(assistant.firstMessage);
    if (assistant.instructions) setInstructions(assistant.instructions);
    if (assistant.model) setModel(assistant.model);
    if (assistant.temperature != null) setTemperature(assistant.temperature);
    if (assistant.voiceId) {
      setVoiceId(assistant.voiceId);
      // Add to dropdown if not already there
      if (!voices.some((v) => v.id === assistant.voiceId)) {
        setExtraVoice({
          id: assistant.voiceId,
          name: `${assistant.voiceId} (${assistant.voiceProvider ?? "custom"})`,
          provider: assistant.voiceProvider ?? "custom",
        });
      }
    }
  }

  async function handleCall() {
    if (!to) {
      toast.error("Please enter a phone number to call.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/test-send/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          assistantId: assistantId === "__none__" ? undefined : assistantId,
          phoneNumberId: phoneNumberId === "__none__" ? undefined : phoneNumberId,
          voice: voiceId === "__none__" ? undefined : voiceId,
          model,
          firstMessage: firstMessage || undefined,
          instructions: instructions || undefined,
          temperature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate call");
      toast.success("Call initiated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate call");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Make Test Call</CardTitle>
            <CardDescription>Initiate a test outbound call via VAPI.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={refreshVapi}
            disabled={vapiLoading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${vapiLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vapiError && (
          <p className="text-xs text-destructive">VAPI not configured. Set up your API key in Integrations first.</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="call-to">To (phone number)</Label>
          <Input
            id="call-to"
            type="tel"
            placeholder="+1234567890"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Assistant</Label>
            <Select
              value={assistantId}
              onValueChange={handleAssistantChange}
              disabled={vapiLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={vapiLoading ? "Loading..." : "Select assistant"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No assistant</SelectItem>
                {assistants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Caller Phone Number</Label>
            <Select
              value={phoneNumberId}
              onValueChange={setPhoneNumberId}
              disabled={vapiLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={vapiLoading ? "Loading..." : "Select phone"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No phone selected</SelectItem>
                {phoneNumbers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name ? `${p.name} (${p.number})` : p.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Voice</Label>
            <Select
              value={voiceId}
              onValueChange={setVoiceId}
              disabled={vapiLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={vapiLoading ? "Loading..." : "Select voice"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Default voice</SelectItem>
                {allVoices.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.provider ? `${v.name} (${v.provider})` : v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="call-first-message">First Message</Label>
          <Textarea
            id="call-first-message"
            placeholder="What the assistant will say first..."
            rows={2}
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="call-instructions">System Instructions</Label>
          <Textarea
            id="call-instructions"
            placeholder="System prompt / instructions for the assistant..."
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="call-temperature">
            Temperature — {temperature.toFixed(1)}
          </Label>
          <input
            id="call-temperature"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 — Precise</span>
            <span>1 — Creative</span>
          </div>
        </div>

        <Button onClick={handleCall} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Phone className="mr-2 h-4 w-4" />
          )}
          Make Call
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestSendPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/integrations/instantly/campaigns")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const items = data.items ?? data.campaigns ?? [];
          setCampaigns(
            items.map((c: { id: string; name: string; status?: number }) => ({
              id: c.id,
              name: c.name,
              status: c.status,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Send a test</h2>
        <p className="text-muted-foreground mt-1">
          Send a one-off test email, SMS, or call to verify your integrations.
        </p>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Email (Instantly)</TabsTrigger>
          <TabsTrigger value="postmark">Email (Postmark)</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="call">Call</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <EmailTab campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="postmark" className="mt-4">
          <PostmarkEmailTab />
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <SmsTab />
        </TabsContent>

        <TabsContent value="call" className="mt-4">
          <CallTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
