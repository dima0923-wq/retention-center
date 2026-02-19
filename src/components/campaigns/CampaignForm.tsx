"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChannelSelector } from "./ChannelSelector";
import { campaignCreateSchema } from "@/lib/validators";

type FormData = z.infer<typeof campaignCreateSchema>;

type CampaignFormProps = {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
};

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
      ...defaultValues,
    },
  });

  const channels = watch("channels") ?? [];

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

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
