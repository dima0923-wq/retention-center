"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { ChannelIcons } from "./ChannelSelector";
import { Users, Calendar } from "lucide-react";
import { format } from "date-fns";

type CampaignCardProps = {
  campaign: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    channels: string[];
    startDate?: string | null;
    endDate?: string | null;
    createdAt: string;
    _count: { campaignLeads: number };
  };
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{campaign.name}</CardTitle>
          <CampaignStatusBadge status={campaign.status} />
        </CardHeader>
        <CardContent>
          {campaign.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {campaign.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ChannelIcons channels={campaign.channels} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{campaign._count.campaignLeads}</span>
              </div>
            </div>
            {campaign.startDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(campaign.startDate), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
