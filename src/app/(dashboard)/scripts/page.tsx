"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScriptList } from "@/components/scripts/ScriptList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

type Script = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  campaignId: string | null;
  campaign: { name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export default function ScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("type", activeTab);
      const res = await fetch(`/api/scripts?${params}`);
      const data = await res.json();
      setScripts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }, [search, activeTab]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/scripts/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Script duplicated");
      fetchScripts();
    } catch {
      toast.error("Failed to duplicate script");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      toast.success("Script deleted");
      fetchScripts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete script");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scripts & Templates</h2>
          <p className="text-muted-foreground mt-1">
            Manage message templates and call scripts.
          </p>
        </div>
        <Button onClick={() => router.push("/scripts/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Script
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search scripts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="CALL">Call</TabsTrigger>
          <TabsTrigger value="SMS">SMS</TabsTrigger>
          <TabsTrigger value="EMAIL">Email</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading scripts...</p>
            </div>
          ) : (
            <ScriptList
              scripts={scripts}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
