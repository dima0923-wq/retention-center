"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const enrollmentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  PAUSED: { label: "Paused", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  CONVERTED: { label: "Converted", variant: "default" },
};

type Enrollment = {
  id: string;
  status: string;
  currentStep: number;
  enrolledAt: string;
  completedAt?: string | null;
  lastStepAt?: string | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
};

type EnrollmentTableProps = {
  enrollments: Enrollment[];
  totalSteps: number;
};

export function EnrollmentTable({ enrollments, totalSteps }: EnrollmentTableProps) {
  if (enrollments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No enrollments yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Enrolled</TableHead>
          <TableHead>Last Step</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {enrollments.map((enrollment) => {
          const statusCfg = enrollmentStatusConfig[enrollment.status] ?? {
            label: enrollment.status,
            variant: "secondary" as const,
          };

          return (
            <TableRow key={enrollment.id}>
              <TableCell className="font-medium">
                {enrollment.lead.firstName} {enrollment.lead.lastName}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {enrollment.lead.email || enrollment.lead.phone || "-"}
              </TableCell>
              <TableCell>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: totalSteps > 0
                          ? `${Math.min((enrollment.currentStep / totalSteps) * 100, 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {enrollment.currentStep}/{totalSteps}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(enrollment.enrolledAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {enrollment.lastStepAt
                  ? format(new Date(enrollment.lastStepAt), "MMM d, HH:mm")
                  : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
