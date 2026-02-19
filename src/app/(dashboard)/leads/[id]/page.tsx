"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { LeadDetailCard } from "@/components/leads/LeadDetailCard";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SendSmsDialog } from "@/components/leads/SendSmsDialog";

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
  { value: "DO_NOT_CONTACT", label: "Do Not Contact" },
];

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editStatus, setEditStatus] = useState("NEW");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  useEffect(() => {
    async function fetchLead() {
      try {
        const res = await fetch(`/api/leads/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setLead(data);
        setEditStatus(data.status);
        setEditNotes(data.notes || "");
      } catch {
        toast.error("Lead not found");
        router.push("/leads");
      } finally {
        setLoading(false);
      }
    }
    fetchLead();
  }, [id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      const updated = await res.json();
      setLead({ ...lead, ...updated });
      toast.success("Lead updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading lead...</p>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Leads
        </Button>
        {lead.phone && (
          <Button variant="outline" size="sm" onClick={() => setSmsOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Send SMS
          </Button>
        )}
      </div>

      <LeadDetailCard lead={lead} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Update Lead</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                className="mt-1"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this lead..."
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <LeadTimeline attempts={lead.contactAttempts || []} />
      </div>

      <SendSmsDialog
        lead={lead}
        open={smsOpen}
        onOpenChange={setSmsOpen}
        onSuccess={() => {
          // Refresh lead data to update timeline
          fetch(`/api/leads/${id}`)
            .then((res) => res.json())
            .then((data) => {
              setLead(data);
              setEditStatus(data.status);
              setEditNotes(data.notes || "");
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
