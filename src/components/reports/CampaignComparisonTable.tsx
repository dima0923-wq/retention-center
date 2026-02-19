"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CampaignData = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  totalLeads: number;
  completed: number;
  conversionRate: number;
};

type CampaignComparisonTableProps = {
  data: CampaignData[];
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  PAUSED: "outline",
  DRAFT: "outline",
};

export function CampaignComparisonTable({
  data,
}: CampaignComparisonTableProps) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Campaign Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No campaigns to display
                </TableCell>
              </TableRow>
            ) : (
              data.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[campaign.status] ?? "outline"}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {campaign.channels.map((ch) => (
                        <Badge key={ch} variant="outline" className="text-xs">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.totalLeads}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.completed}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.conversionRate}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
