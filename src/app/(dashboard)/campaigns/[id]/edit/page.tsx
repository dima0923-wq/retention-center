"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { toast } from "sonner";
import { format } from "date-fns";

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<{
    name: string;
    description?: string;
    channels: string[];
    startDate?: string | null;
    endDate?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setCampaign({
          name: data.name,
          description: data.description ?? "",
          channels: data.channels,
          startDate: data.startDate ? format(new Date(data.startDate), "yyyy-MM-dd") : "",
          endDate: data.endDate ? format(new Date(data.endDate), "yyyy-MM-dd") : "",
        });
      })
      .catch(() => router.push("/campaigns"));
  }, [id, router]);

  const handleSubmit = async (data: { name: string; description?: string; channels: string[]; startDate?: string; endDate?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update campaign");
      }
      toast.success("Campaign updated successfully");
      router.push(`/campaigns/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update campaign");
    } finally {
      setIsLoading(false);
    }
  };

  if (!campaign) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Campaign</h2>
        <p className="text-muted-foreground mt-1">Update campaign details.</p>
      </div>
      <CampaignForm
        defaultValues={{
          name: campaign.name,
          description: campaign.description,
          channels: campaign.channels as ("CALL" | "SMS" | "EMAIL")[],
          startDate: campaign.startDate ?? "",
          endDate: campaign.endDate ?? "",
        }}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitLabel="Save Changes"
      />
    </div>
  );
}
