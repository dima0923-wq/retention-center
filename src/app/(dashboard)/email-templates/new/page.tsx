"use client";

import { useState } from "react";
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
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_VARIABLES = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "companyName",
  "unsubscribeUrl",
];

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [fromEmail, setFromEmail] = useState("noreply@example.com");
  const [fromName, setFromName] = useState("Retention Center");
  const [trigger, setTrigger] = useState("manual");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const insertVariable = (field: "subject" | "htmlBody" | "textBody", variable: string) => {
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
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlBody,
          textBody: textBody || undefined,
          fromEmail,
          fromName,
          trigger,
          isDefault,
        }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      toast.success("Email template created");
      router.push("/email-templates");
    } catch {
      toast.error("Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/email-templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">
          New Email Template
        </h2>
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
              placeholder="e.g., Welcome Email"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Email</Label>
              <Input
                className="mt-1"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@example.com"
              />
            </div>
            <div>
              <Label>From Name</Label>
              <Input
                className="mt-1"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Retention Center"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="new_lead">New Lead</SelectItem>
                  <SelectItem value="conversion">Conversion</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Set as default template
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
              placeholder="e.g., Welcome to {{companyName}}!"
            />
          </div>
          <div>
            <Label>HTML Body</Label>
            <Textarea
              className="mt-1 min-h-[200px] font-mono text-sm"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="<h1>Hello {{firstName}}</h1>..."
            />
          </div>
          <div>
            <Label>Text Body (optional)</Label>
            <Textarea
              className="mt-1 min-h-[100px] font-mono text-sm"
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder="Plain text version of the email..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !name || !subject}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Create Template"}
        </Button>
      </div>
    </div>
  );
}
