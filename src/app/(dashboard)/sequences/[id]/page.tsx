"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SequenceTimeline } from "@/components/sequences/SequenceTimeline";
import { EnrollmentTable } from "@/components/sequences/EnrollmentTable";
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Users,
  TrendingUp,
  Clock,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  PAUSED: { label: "Paused", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "destructive" },
};

const triggerLabels: Record<string, string> = {
  manual: "Manual",
  new_lead: "New Lead",
  no_conversion: "No Conversion",
};

type Step = {
  id: string;
  stepOrder: number;
  channel: string;
  scriptId?: string | null;
  script?: { name: string } | null;
  delayValue: number;
  delayUnit: string;
  isActive: boolean;
  _count?: { executions: number };
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

type SequenceDetail = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  channels: string;
  triggerType: string;
  triggerConfig: string;
  createdAt: string;
  updatedAt: string;
  steps: Step[];
  enrollments: Enrollment[];
  _count: { steps: number; enrollments: number };
  stats?: {
    totalEnrolled: number;
    activeEnrolled: number;
    completed: number;
    converted: number;
    conversionRate: number;
  };
};

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sequence, setSequence] = useState<SequenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchSequence = useCallback(async () => {
    try {
      const res = await fetch(`/api/sequences/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setSequence(data);
    } catch (err) {
      console.error("Failed to fetch sequence:", err);
      toast.error("Sequence not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSequence();
  }, [fetchSequence]);

  const toggleStatus = async () => {
    if (!sequence) return;
    setToggling(true);
    const newStatus = sequence.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSequence((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast.success(`Sequence ${newStatus === "ACTIVE" ? "activated" : "paused"}`);
    } catch {
      toast.error("Failed to update sequence status");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading sequence...</div>
    );
  }

  if (!sequence) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Sequence not found.</p>
        <Link href="/sequences">
          <Button variant="outline">Back to Sequences</Button>
        </Link>
      </div>
    );
  }

  const statusCfg = statusConfig[sequence.status] ?? {
    label: sequence.status,
    variant: "secondary" as const,
  };

  const stats = sequence.stats ?? {
    totalEnrolled: sequence._count.enrollments,
    activeEnrolled: sequence.enrollments.filter((e) => e.status === "ACTIVE").length,
    completed: sequence.enrollments.filter((e) => e.status === "COMPLETED").length,
    converted: sequence.enrollments.filter((e) => e.status === "CONVERTED").length,
    conversionRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sequences")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{sequence.name}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            {sequence.description && (
              <p className="text-muted-foreground mt-1">{sequence.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(sequence.status === "ACTIVE" || sequence.status === "PAUSED" || sequence.status === "DRAFT") && (
            <Button
              variant={sequence.status === "ACTIVE" ? "outline" : "default"}
              onClick={toggleStatus}
              disabled={toggling}
            >
              {sequence.status === "ACTIVE" ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          )}
          <Link href={`/sequences/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enrolled
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEnrolled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeEnrolled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Converted
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.converted}
              {stats.totalEnrolled > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({((stats.converted / stats.totalEnrolled) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="flow">
        <TabsList>
          <TabsTrigger value="flow">Sequence Flow</TabsTrigger>
          <TabsTrigger value="enrollments">
            Enrollments ({sequence._count.enrollments})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Steps</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Trigger: {triggerLabels[sequence.triggerType] ?? sequence.triggerType}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{sequence._count.steps} step{sequence._count.steps !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SequenceTimeline steps={sequence.steps} showStats />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <EnrollmentTable
                enrollments={sequence.enrollments}
                totalSteps={sequence._count.steps}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Meta info */}
      <div className="text-xs text-muted-foreground flex items-center gap-4">
        <span>Created: {format(new Date(sequence.createdAt), "MMM d, yyyy HH:mm")}</span>
        <span>Updated: {format(new Date(sequence.updatedAt), "MMM d, yyyy HH:mm")}</span>
      </div>
    </div>
  );
}
