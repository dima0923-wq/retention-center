"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallScriptEditor } from "@/components/scripts/CallScriptEditor";
import { SmsTemplateEditor } from "@/components/scripts/SmsTemplateEditor";
import { EmailTemplateEditor } from "@/components/scripts/EmailTemplateEditor";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export default function NewScriptPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"CALL" | "SMS" | "EMAIL" | "">("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [vapiConfig, setVapiConfig] = useState<Record<string, unknown>>({
    model: "gpt-4o",
    voice: "alloy",
    temperature: 0.7,
    firstMessage: "",
    instructions: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !type) {
      toast.error("Name and type are required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, type };
      if (type === "CALL") {
        body.vapiConfig = vapiConfig;
      } else if (type === "EMAIL") {
        body.content = JSON.stringify({ subject, body: content });
      } else {
        body.content = content;
      }

      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create script");
      const script = await res.json();
      toast.success("Script created");
      router.push(`/scripts/${script.id}`);
    } catch {
      toast.error("Failed to create script");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/scripts")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">New Script</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Script Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Call Script"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "CALL" | "SMS" | "EMAIL")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select script type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALL">Call (VAPI)</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {type === "CALL" && (
        <CallScriptEditor config={vapiConfig} onChange={setVapiConfig} />
      )}
      {type === "SMS" && (
        <SmsTemplateEditor content={content} onChange={setContent} />
      )}
      {type === "EMAIL" && (
        <EmailTemplateEditor
          subject={subject}
          body={content}
          onSubjectChange={setSubject}
          onBodyChange={setContent}
        />
      )}

      {type && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !name}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Create Script"}
          </Button>
        </div>
      )}
    </div>
  );
}
