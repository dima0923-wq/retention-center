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
import type { PwaFlowStatisticsUser, PwaFlowPaginationMeta } from "@/types/pwaflow";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

type PwaUsersListProps = {
  users: PwaFlowStatisticsUser[];
  meta: PwaFlowPaginationMeta | null;
  page: number;
  onPageChange: (page: number) => void;
  loading: boolean;
};

export function PwaUsersList({ users, meta, page, onPageChange, loading }: PwaUsersListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found for this PWA.
      </div>
    );
  }

  const totalPages = meta?.total ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>PWA</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">
                  {user.id ? user.id.slice(0, 12) + "..." : "-"}
                </TableCell>
                <TableCell>
                  {user.country ? (
                    <Badge variant="outline" className="text-xs">
                      {user.country}
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-sm">{user.os_name ?? "-"}</TableCell>
                <TableCell>
                  {user.is_bot != null ? (
                    <Badge variant={user.is_bot ? "destructive" : "secondary"} className="text-xs">
                      {user.is_bot ? "Bot" : "Human"}
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {user.is_pwa != null ? (
                    <Badge variant={user.is_pwa ? "default" : "outline"} className="text-xs">
                      {user.is_pwa ? "Yes" : "No"}
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.created_at
                    ? format(parseISO(user.created_at), "MMM d, yyyy HH:mm")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
