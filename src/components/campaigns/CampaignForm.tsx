"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelSelector } from "./ChannelSelector";
import { campaignCreateSchema } from "@/lib/validators";
import { Plus, Trash2, Mail, Clock, Zap, Phone, RefreshCw, FileText } from "lucide-react";
import { useVapiResources, type VapiVoice } from "@/hooks/use-vapi-resources";

type EmailTemplateOption = {
  id: string;
  name: string;
  subject: string;
  fromEmail: string;
  fromName: string;
};

const VAPI_MODELS = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet" },
];

type VapiConfig = {
  assistantId?: string;
  phoneNumberId?: string;
  voice?: string;
  model?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
};

type FormData = z.infer<typeof campaignCreateSchema>;

type EmailStep = {
  subject: string;
  body: string;
  delayValue: number;
  delayUnit: "HOURS" | "DAYS" | "WEEKS";
};

type CampaignFormProps = {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
};

const VARIABLES = [
  { label: "First Name", value: "{{firstName}}" },
  { label: "Last Name", value: "{{lastName}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "Company", value: "{{company}}" },
];

export function CampaignForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Create Campaign",
}: CampaignFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(campaignCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      channels: [],
      startDate: "",
      endDate: "",
      instantlySync: false,
      emailSequence: [],
      contactHoursStart: "",
      contactHoursEnd: "",
      contactDays: [],
      maxContactsPerDay: undefined,
      delayBetweenChannels: undefined,
      autoAssign: { enabled: false, sources: [], maxLeads: undefined, executionMode: "parallel" },
      ...defaultValues,
    },
  });

  const channels = watch("channels") ?? [];
  const instantlySync = watch("instantlySync") ?? false;
  const emailSequence = watch("emailSequence") ?? [];
  const contactDays = watch("contactDays") ?? [];
  const hasCall = channels.includes("CALL");
  const hasEmail = channels.includes("EMAIL");
  const autoAssign = watch("autoAssign");

  // Email template selection for campaign-level Postmark sending
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateOption[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailTemplateId, setEmailTemplateId] = useState<string>(() => {
    const dv = defaultValues as Record<string, unknown> | undefined;
    return (dv?.emailTemplateId as string) ?? "__none__";
  });

  useEffect(() => {
    if (!hasEmail) return;
    setEmailTemplatesLoading(true);
    fetch("/api/email-templates?isActive=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmailTemplateOption[]) => {
        setEmailTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setEmailTemplatesLoading(false));
  }, [hasEmail]);

  const [activeStepField, setActiveStepField] = useState<{ stepIdx: number; field: "subject" | "body" } | null>(null);
  const stepIdsRef = useRef<string[]>([]);

  // VAPI campaign-level config — read from defaultValues.vapiConfig
  const [vapiConfig, setVapiConfig] = useState<VapiConfig>(() => {
    const dv = defaultValues as Record<string, unknown> | undefined;
    const raw = dv?.vapiConfig;
    if (raw && typeof raw === "object") return raw as VapiConfig;
    return {};
  });

  const {
    assistants: vapiAssistants,
    phoneNumbers: vapiPhoneNumbers,
    voices: vapiVoices,
    loading: vapiLoading,
    error: vapiError,
    refresh: refreshVapi,
  } = useVapiResources({ enabled: hasCall });
  const [extraVoice, setExtraVoice] = useState<VapiVoice | null>(null);

  const allVapiVoices = extraVoice && !vapiVoices.some((v) => v.id === extraVoice.id)
    ? [...vapiVoices, extraVoice]
    : vapiVoices;

  const updateVapiConfig = (patch: Partial<VapiConfig>) => {
    setVapiConfig((prev) => {
      const updated = { ...prev, ...patch };
      setValue("vapiConfig" as Parameters<typeof setValue>[0], updated);
      return updated;
    });
  };

  const handleVapiAssistantChange = (v: string) => {
    const id = v === "__default__" ? undefined : v;
    const patch: Partial<VapiConfig> = { assistantId: id };
    if (id) {
      const assistant = vapiAssistants.find((a) => a.id === id);
      if (assistant) {
        if (assistant.firstMessage) patch.firstMessage = assistant.firstMessage;
        if (assistant.instructions) patch.instructions = assistant.instructions;
        if (assistant.model) patch.model = assistant.model;
        if (assistant.temperature != null) patch.temperature = assistant.temperature;
        if (assistant.voiceId) {
          patch.voice = assistant.voiceId;
          if (!vapiVoices.some((v) => v.id === assistant.voiceId)) {
            setExtraVoice({
              id: assistant.voiceId,
              name: `${assistant.voiceId} (${assistant.voiceProvider ?? "custom"})`,
              provider: assistant.voiceProvider ?? "custom",
            });
          }
        }
      }
    }
    updateVapiConfig(patch);
  };

  // Group voices by provider
  const voicesByProvider = allVapiVoices.reduce<Record<string, VapiVoice[]>>((acc, v) => {
    (acc[v.provider] = acc[v.provider] ?? []).push(v);
    return acc;
  }, {});

  const addStep = () => {
    const newSteps: EmailStep[] = [
      ...emailSequence,
      { subject: "", body: "", delayValue: 1, delayUnit: "DAYS" },
    ];
    stepIdsRef.current = [...stepIdsRef.current, crypto.randomUUID()];
    setValue("emailSequence", newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = emailSequence.filter((_, i) => i !== index);
    stepIdsRef.current = stepIdsRef.current.filter((_, i) => i !== index);
    setValue("emailSequence", newSteps);
  };

  const updateStep = (index: number, field: keyof EmailStep, value: string | number) => {
    const newSteps = [...emailSequence];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setValue("emailSequence", newSteps);
  };

  const insertVariable = (variable: string) => {
    if (!activeStepField) return;
    const { stepIdx, field } = activeStepField;
    const current = emailSequence[stepIdx]?.[field] ?? "";
    updateStep(stepIdx, field, current + variable);
  };

  const handleEmailTemplateChange = (id: string) => {
    setEmailTemplateId(id);
    const value = id === "__none__" ? undefined : id;
    setValue("emailTemplateId" as Parameters<typeof setValue>[0], value);
  };

  const handleFormSubmit = async (data: FormData) => {
    // vapiConfig and emailTemplateId are already in data via setValue — nothing extra needed
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="name">Campaign Name</Label>
        <Input id="name" placeholder="e.g. Q1 Outreach" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Campaign description..."
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Channels</Label>
        <ChannelSelector
          value={channels}
          onChange={(val) => setValue("channels", val as ("CALL" | "SMS" | "EMAIL")[], { shouldValidate: true })}
        />
        {errors.channels && (
          <p className="text-sm text-destructive">{errors.channels.message}</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <CardTitle className="text-base">Auto-Assignment</CardTitle>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAssign?.enabled ?? false}
                onChange={(e) =>
                  setValue("autoAssign", {
                    ...autoAssign,
                    enabled: e.target.checked,
                    sources: autoAssign?.sources ?? [],
                    executionMode: autoAssign?.executionMode ?? "parallel",
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Auto-assign incoming leads</span>
            </label>
          </div>
        </CardHeader>

        {autoAssign?.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source Filter</Label>
              <p className="text-xs text-muted-foreground">Which lead sources should be auto-assigned to this campaign</p>
              <div className="flex flex-wrap gap-3">
                {(["META", "API", "MANUAL", "BULK"] as const).map((source) => {
                  const sources = autoAssign?.sources ?? [];
                  const isChecked = sources.includes(source);
                  return (
                    <label key={source} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const updated = isChecked
                            ? sources.filter((s) => s !== source)
                            : [...sources, source];
                          setValue("autoAssign", { ...autoAssign!, sources: updated });
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{source}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoAssignMaxLeads">Maximum leads to accept</Label>
              <Input
                id="autoAssignMaxLeads"
                type="number"
                min={1}
                placeholder="e.g. 1000 (unlimited if empty)"
                value={autoAssign?.maxLeads ?? ""}
                onChange={(e) =>
                  setValue("autoAssign", {
                    ...autoAssign!,
                    maxLeads: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Channel execution mode</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="executionMode"
                    checked={autoAssign?.executionMode === "parallel"}
                    onChange={() => setValue("autoAssign", { ...autoAssign!, executionMode: "parallel" })}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">All channels at once</span>
                    <p className="text-xs text-muted-foreground">Fire SMS + Email + Call simultaneously on lead arrival</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="executionMode"
                    checked={autoAssign?.executionMode === "sequential"}
                    onChange={() => setValue("autoAssign", { ...autoAssign!, executionMode: "sequential" })}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">Sequential with delays</span>
                    <p className="text-xs text-muted-foreground">Follow channel priority with configured delays</p>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" {...register("endDate")} />
        </div>
      </div>

      {hasEmail && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <CardTitle className="text-base">Email Template</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Select an email template for Postmark sending. When set, campaign emails will use this template instead of the script content.
            </p>
            <Select
              value={emailTemplateId}
              onValueChange={handleEmailTemplateChange}
              disabled={emailTemplatesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={emailTemplatesLoading ? "Loading templates..." : "No template (use script)"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No template (use script)</SelectItem>
                {emailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {emailTemplateId !== "__none__" && (
              <div className="rounded-md border p-3 bg-muted/50">
                <p className="text-sm font-medium">
                  {emailTemplates.find((t) => t.id === emailTemplateId)?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subject: {emailTemplates.find((t) => t.id === emailTemplateId)?.subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  From: {emailTemplates.find((t) => t.id === emailTemplateId)?.fromName} &lt;{emailTemplates.find((t) => t.id === emailTemplateId)?.fromEmail}&gt;
                </p>
              </div>
            )}
            {emailTemplates.length === 0 && !emailTemplatesLoading && (
              <p className="text-xs text-muted-foreground">
                No active templates found. Create one in Email Templates first.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {channels.includes("EMAIL") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <CardTitle className="text-base">Instantly.ai Sync</CardTitle>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instantlySync}
                  onChange={(e) => setValue("instantlySync", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Enable sync</span>
              </label>
            </div>
          </CardHeader>

          {instantlySync && (
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Configure the email sequence that will be pushed to Instantly.ai
                </p>
                <div className="flex gap-1 flex-wrap">
                  {VARIABLES.map((v) => (
                    <Button
                      key={v.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => insertVariable(v.value)}
                      disabled={!activeStepField}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {emailSequence.map((step, idx) => (
                <Card key={stepIdsRef.current[idx] ?? idx} className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Step {idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(idx)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {idx > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          Wait
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.delayValue}
                          onChange={(e) => updateStep(idx, "delayValue", parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                        <select
                          value={step.delayUnit}
                          onChange={(e) => updateStep(idx, "delayUnit", e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="HOURS">hours</option>
                          <option value="DAYS">days</option>
                        </select>
                        <Label className="text-xs text-muted-foreground">before sending</Label>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">Subject</Label>
                      <Input
                        placeholder="Email subject..."
                        value={step.subject}
                        onChange={(e) => updateStep(idx, "subject", e.target.value)}
                        onFocus={() => setActiveStepField({ stepIdx: idx, field: "subject" })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Body</Label>
                      <Textarea
                        placeholder="Email body..."
                        rows={4}
                        value={step.body}
                        onChange={(e) => updateStep(idx, "body", e.target.value)}
                        onFocus={() => setActiveStepField({ stepIdx: idx, field: "body" })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStep}
                className="w-full border-dashed"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {channels.includes("CALL") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <CardTitle className="text-base">Voice (VAPI) Settings</CardTitle>
              </div>
              <Button
                type="button"
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
            <p className="text-xs text-muted-foreground">
              Override VAPI defaults for this campaign. Leave blank to use integration defaults.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assistant</Label>
                <Select
                  value={vapiConfig.assistantId ?? "__default__"}
                  onValueChange={handleVapiAssistantChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Use integration default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use integration default</SelectItem>
                    {vapiAssistants.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Select
                  value={vapiConfig.phoneNumberId ?? "__default__"}
                  onValueChange={(v) => updateVapiConfig({ phoneNumberId: v === "__default__" ? undefined : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Use integration default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use integration default</SelectItem>
                    {vapiPhoneNumbers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name ?? p.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select
                  value={vapiConfig.voice ?? "__default__"}
                  onValueChange={(v) => updateVapiConfig({ voice: v === "__default__" ? undefined : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Use assistant default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use assistant default</SelectItem>
                    {Object.entries(voicesByProvider).map(([provider, voices]) => (
                      <SelectGroup key={provider}>
                        <SelectLabel className="capitalize">{provider}</SelectLabel>
                        {voices.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={vapiConfig.model ?? "__default__"}
                  onValueChange={(v) => updateVapiConfig({ model: v === "__default__" ? undefined : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Use assistant default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use assistant default</SelectItem>
                    {VAPI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vapiFirstMessage">First Message</Label>
              <Textarea
                id="vapiFirstMessage"
                placeholder="Hi {{firstName}}, this is..."
                rows={2}
                value={vapiConfig.firstMessage ?? ""}
                onChange={(e) => updateVapiConfig({ firstMessage: e.target.value || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vapiInstructions">System Instructions</Label>
              <Textarea
                id="vapiInstructions"
                placeholder="You are a friendly sales rep..."
                rows={4}
                value={vapiConfig.instructions ?? ""}
                onChange={(e) => updateVapiConfig({ instructions: e.target.value || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vapiTemperature">
                Temperature: {vapiConfig.temperature ?? 0.7}
              </Label>
              <input
                id="vapiTemperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={vapiConfig.temperature ?? 0.7}
                onChange={(e) => updateVapiConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise (0)</span>
                <span>Creative (1)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <CardTitle className="text-base">Schedule & Rate Limiting</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactHoursStart">Contact Hours Start</Label>
              <Input
                id="contactHoursStart"
                type="time"
                {...register("contactHoursStart")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactHoursEnd">Contact Hours End</Label>
              <Input
                id="contactHoursEnd"
                type="time"
                {...register("contactHoursEnd")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact Days</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Sun", value: 0 },
                { label: "Mon", value: 1 },
                { label: "Tue", value: 2 },
                { label: "Wed", value: 3 },
                { label: "Thu", value: 4 },
                { label: "Fri", value: 5 },
                { label: "Sat", value: 6 },
              ].map((day) => {
                const isSelected = contactDays.includes(day.value);
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-12"
                    onClick={() => {
                      const updated = isSelected
                        ? contactDays.filter((d: number) => d !== day.value)
                        : [...contactDays, day.value].sort();
                      setValue("contactDays", updated);
                    }}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxContactsPerDay">Max Contacts Per Lead/Day</Label>
              <Input
                id="maxContactsPerDay"
                type="number"
                min={1}
                placeholder="e.g. 3"
                {...register("maxContactsPerDay", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delayBetweenChannels">Channel Escalation Delay (hours)</Label>
              <Input
                id="delayBetweenChannels"
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 2"
                {...register("delayBetweenChannels", { valueAsNumber: true })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Configure when leads can be contacted. If outside hours or rate limited, contacts will be scheduled for the next available slot.
          </p>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
