"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Mail, Phone, Calendar, Tag, FileText } from "lucide-react";
import { format } from "date-fns";
type LeadDetailCardProps = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    source: string;
    status: string;
    notes: string | null;
    externalId: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export function LeadDetailCard({ lead }: LeadDetailCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">
            {lead.firstName} {lead.lastName}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">ID: {lead.id}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{lead.email || "No email"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{lead.phone || "No phone"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span>Source: {lead.source}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Created: {format(new Date(lead.createdAt), "MMM d, yyyy HH:mm")}</span>
          </div>
        </div>
        {lead.notes && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Notes
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
