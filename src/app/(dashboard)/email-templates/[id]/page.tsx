"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_VARIABLES = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "companyName",
  "unsubscribeUrl",
];

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  fromEmail: string;
  fromName: string;
  trigger: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/email-templates/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data: EmailTemplate = await res.json();
        setTemplate(data);
        setName(data.name);
        setSubject(data.subject);
        setHtmlBody(data.htmlBody);
        setTextBody(data.textBody || "");
        setFromEmail(data.fromEmail);
        setFromName(data.fromName);
        setTrigger(data.trigger);
        setIsActive(data.isActive);
        setIsDefault(data.isDefault);
      } catch {
        toast.error("Template not found");
        router.push("/email-templates");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [id, router]);

  const insertVariable = (
    field: "subject" | "htmlBody" | "textBody",
    variable: string
  ) => {
    const tag = `{{${variable}}}`;
    if (field === "subject") setSubject((v) => v + tag);
    else if (field === "htmlBody") setHtmlBody((v) => v + tag);
    else setTextBody((v) => v + tag);
  };

  const handleSave = async () => {
    if (!name || !subject || !htmlBody) {
      toast.error("Name, subject, and HTML body are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlBody,
          textBody: textBody || null,
          fromEmail,
          fromName,
          trigger,
          isActive,
          isDefault,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = await res.json();
      setTemplate(updated);
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/email-templates/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const copy = await res.json();
      toast.success("Template duplicated");
      router.push(`/email-templates/${copy.id}`);
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      toast.success("Template deleted");
      router.push("/email-templates");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/email-templates")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">Edit Template</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-1" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template Details</CardTitle>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Email</Label>
              <Input
                className="mt-1"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>From Name</Label>
              <Input
                className="mt-1"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="new_lead">New Lead</SelectItem>
                  <SelectItem value="conversion">Conversion</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Default
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Email Content</CardTitle>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">
                Insert:
              </span>
              {AVAILABLE_VARIABLES.map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => insertVariable("htmlBody", v)}
                >
                  {`{{${v}}}`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              className="mt-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label>HTML Body</Label>
            <Textarea
              className="mt-1 min-h-[200px] font-mono text-sm"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
            />
          </div>
          <div>
            <Label>Text Body (optional)</Label>
            <Textarea
              className="mt-1 min-h-[100px] font-mono text-sm"
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !name || !subject}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
