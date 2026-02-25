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

type LeadEntry = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CONTACTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  QUALIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CONVERTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  LOST: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

export function WebhookActivity({
  leads,
  loading,
}: {
  leads: LeadEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading activity...
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leads received yet.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatTime(lead.createdAt)}
              </TableCell>
              <TableCell className="font-medium text-sm">
                {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
              </TableCell>
              <TableCell className="text-sm">{lead.email ?? "—"}</TableCell>
              <TableCell className="text-sm">{lead.phone ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={statusColors[lead.status] ?? statusColors.NEW}
                >
                  {lead.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
