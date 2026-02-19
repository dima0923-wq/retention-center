"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallScriptEditor } from "@/components/scripts/CallScriptEditor";
import { SmsTemplateEditor } from "@/components/scripts/SmsTemplateEditor";
import { EmailTemplateEditor } from "@/components/scripts/EmailTemplateEditor";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

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
  const [subject, setSubject] = useState("");
  const [vapiConfig, setVapiConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        } else if (data.type === "EMAIL") {
          try {
            const parsed = JSON.parse(data.content || "{}");
            setSubject(parsed.subject || "");
            setContent(parsed.body || "");
          } catch {
            setContent(data.content || "");
          }
        } else {
          setContent(data.content || "");
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
        body.content = JSON.stringify({ subject, body: content });
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
      {script.type === "EMAIL" && (
        <EmailTemplateEditor
          subject={subject}
          body={content}
          onSubjectChange={setSubject}
          onBodyChange={setContent}
        />
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
