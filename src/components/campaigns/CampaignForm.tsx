"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelSelector } from "./ChannelSelector";
import { campaignCreateSchema } from "@/lib/validators";
import { Plus, Trash2, Mail } from "lucide-react";

type FormData = z.infer<typeof campaignCreateSchema>;

type EmailStep = {
  subject: string;
  body: string;
  delayValue: number;
  delayUnit: "hours" | "days";
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
      ...defaultValues,
    },
  });

  const channels = watch("channels") ?? [];
  const instantlySync = watch("instantlySync") ?? false;
  const emailSequence = watch("emailSequence") ?? [];

  const [activeStepField, setActiveStepField] = useState<{ stepIdx: number; field: "subject" | "body" } | null>(null);

  const addStep = () => {
    const newSteps: EmailStep[] = [
      ...emailSequence,
      { subject: "", body: "", delayValue: 1, delayUnit: "days" },
    ];
    setValue("emailSequence", newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = emailSequence.filter((_, i) => i !== index);
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
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
                <Card key={idx} className="border-dashed">
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
                          <option value="hours">hours</option>
                          <option value="days">days</option>
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

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
