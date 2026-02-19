"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallScriptEditor } from "@/components/scripts/CallScriptEditor";
import { SmsTemplateEditor } from "@/components/scripts/SmsTemplateEditor";
import { EmailTemplateEditor, type EmailStep } from "@/components/scripts/EmailTemplateEditor";
import { ScriptPreview } from "@/components/scripts/ScriptPreview";
import { ArrowLeft, Save, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";

function parseEmailContent(content: string): EmailStep[] {
  try {
    const parsed = JSON.parse(content || "{}");
    // New multi-step format
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      return parsed.steps;
    }
    // Legacy single-email format: { subject, body }
    if (parsed.subject || parsed.body) {
      return [{ subject: parsed.subject || "", body: parsed.body || "", delay_days: 0 }];
    }
  } catch {
    // Plain text fallback
    if (content) {
      return [{ subject: "", body: content, delay_days: 0 }];
    }
  }
  return [{ subject: "", body: "", delay_days: 0 }];
}

export default function EditScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [script, setScript] = useState<any>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [emailSteps, setEmailSteps] = useState<EmailStep[]>([]);
  const [vapiConfig, setVapiConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function fetchScript() {
      try {
        const res = await fetch(`/api/scripts/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setScript(data);
        setName(data.name);
        if (data.type === "CALL") {
          setVapiConfig(data.vapiConfig || {});
          setEditing(true);
        } else if (data.type === "EMAIL") {
          setEmailSteps(parseEmailContent(data.content));
        } else {
          setContent(data.content || "");
          setEditing(true);
        }
      } catch {
        toast.error("Script not found");
        router.push("/scripts");
      } finally {
        setLoading(false);
      }
    }
    fetchScript();
  }, [id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name };
      if (script.type === "CALL") {
        body.vapiConfig = vapiConfig;
      } else if (script.type === "EMAIL") {
        body.content = JSON.stringify({ steps: emailSteps });
      } else {
        body.content = content;
      }

      const res = await fetch(`/api/scripts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = await res.json();
      setScript(updated);
      if (script.type === "EMAIL") {
        setEditing(false);
      }
      toast.success("Script saved");
    } catch {
      toast.error("Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading script...</p>
      </div>
    );
  }

  if (!script) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/scripts")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">Edit Script</h2>
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
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Type: <span className="font-medium">{script.type}</span>
            {script.campaign && (
              <> | Campaign: <span className="font-medium">{script.campaign.name}</span></>
            )}
          </div>
        </CardContent>
      </Card>

      {script.type === "CALL" && (
        <CallScriptEditor config={vapiConfig} onChange={setVapiConfig} />
      )}
      {script.type === "SMS" && (
        <SmsTemplateEditor content={content} onChange={setContent} />
      )}
      {script.type === "EMAIL" && !editing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Email Sequence</h3>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit Sequence
            </Button>
          </div>
          <ScriptPreview type="EMAIL" steps={emailSteps} />
        </div>
      )}
      {script.type === "EMAIL" && editing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Edit Email Sequence</h3>
            {emailSteps.some((s) => s.subject || s.body) && (
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <Eye className="h-4 w-4 mr-1" />
                Preview Mode
              </Button>
            )}
          </div>
          <EmailTemplateEditor steps={emailSteps} onStepsChange={setEmailSteps} />
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !name}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
