"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: string;
};

function LeadsContent() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "20");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads?${searchParams.toString()}`);
      const data = await res.json();
      setLeads(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground mt-1">
            Manage and track your leads pipeline.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <LeadFilters />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading leads...</p>
        </div>
      ) : (
        <LeadTable
          leads={leads}
          total={total}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
        />
      )}

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchLeads}
      />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
