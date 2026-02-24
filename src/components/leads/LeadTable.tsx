"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

const scoreLabelConfig: Record<string, { label: string; className: string }> = {
  HOT: { label: "Hot", className: "bg-red-100 text-red-800 border-red-200" },
  WARM: { label: "Warm", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  COLD: { label: "Cold", className: "bg-blue-100 text-blue-800 border-blue-200" },
  DEAD: { label: "Dead", className: "bg-gray-100 text-gray-800 border-gray-200" },
  NEW: { label: "New", className: "bg-green-100 text-green-800 border-green-200" },
};

function ScoreLabelBadge({ score, label }: { score: number; label: string }) {
  const config = scoreLabelConfig[label] || { label: label, className: "" };
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{score}</span>
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    </div>
  );
}

import { format } from "date-fns";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  score: number;
  scoreLabel: string;
  createdAt: string;
};

type LeadTableProps = {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function LeadTable({ leads, total, page, pageSize, totalPages }: LeadTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get("sortBy");
    const currentOrder = params.get("sortOrder") || "desc";

    if (currentSort === field) {
      params.set("sortOrder", currentOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", field);
      params.set("sortOrder", "asc");
    }
    router.push(`/leads?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/leads?${params.toString()}`);
  };

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton field="firstName">Name</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="email">Email</SortButton>
            </TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>
              <SortButton field="source">Source</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="score">Score</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="createdAt">Created</SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.email || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.phone || "—"}
                </TableCell>
                <TableCell>{lead.source}</TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell>
                  <ScoreLabelBadge score={lead.score} label={lead.scoreLabel} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(lead.createdAt), "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
