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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

type CampaignLeadEntry = {
  id: string;
  status: string;
  assignedAt: string;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    status: string;
  };
};

type CampaignLeadTableProps = {
  leads: CampaignLeadEntry[];
  onRemove?: (leadIds: string[]) => void;
  isRemoving?: boolean;
};

const campaignLeadStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "destructive",
  SKIPPED: "outline",
};

export function CampaignLeadTable({ leads, onRemove, isRemoving }: CampaignLeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leads assigned to this campaign yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Campaign Status</TableHead>
          <TableHead>Assigned</TableHead>
          {onRemove && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">
              {entry.lead.firstName} {entry.lead.lastName}
            </TableCell>
            <TableCell>{entry.lead.email ?? "-"}</TableCell>
            <TableCell>{entry.lead.phone ?? "-"}</TableCell>
            <TableCell>
              <Badge variant={campaignLeadStatusVariant[entry.status] ?? "secondary"}>
                {entry.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {format(new Date(entry.assignedAt), "MMM d, yyyy")}
            </TableCell>
            {onRemove && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isRemoving}
                  onClick={() => onRemove([entry.lead.id])}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
