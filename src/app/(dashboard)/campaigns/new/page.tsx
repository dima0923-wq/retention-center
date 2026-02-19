"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { toast } from "sonner";

export default function NewCampaignPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: { name: string; description?: string; channels: string[]; startDate?: string; endDate?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create campaign");
      }
      const campaign = await res.json();
      toast.success("Campaign created successfully");
      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Campaign</h2>
        <p className="text-muted-foreground mt-1">
          Create a new outreach campaign.
        </p>
      </div>
      <CampaignForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
