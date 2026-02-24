"use client";

import { useEffect, useRef, useState, use } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Copy, Trash2, Eye, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_VARIABLES = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "companyName",
  "unsubscribeUrl",
];

const SAMPLE_VARIABLES: Record<string, string> = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  companyName: "Acme Inc.",
  unsubscribeUrl: "#",
  baseUrl: typeof window !== "undefined" ? window.location.origin : "https://ag2.q37fh758g.click",
};

function fillVariables(html: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ag2.q37fh758g.click";
  let filled = html.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_VARIABLES[key] || `{{${key}}}`);
  // Inject <base> so relative image paths (e.g. "dog_house.png") resolve to /email-assets/
  if (!filled.includes("<base ")) {
    filled = filled.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/email-assets/">`);
    if (!filled.includes("<base ")) {
      filled = `<base href="${origin}/email-assets/">` + filled;
    }
  }
  return filled;
}

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

type PostmarkDomain = { ID: number; Name: string; DKIMVerified: boolean; ReturnPathDomainVerified: boolean };
type PostmarkSender = { ID: number; EmailAddress: string; Name: string; Confirmed: boolean; Domain: string };

export default function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [fromLocalPart, setFromLocalPart] = useState("");
  const [fromDomain, setFromDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("code");
  const [domains, setDomains] = useState<PostmarkDomain[]>([]);
  const [senders, setSenders] = useState<PostmarkSender[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  const fromEmail = fromDomain ? `${fromLocalPart}@${fromDomain}` : (fromLocalPart || "");

  useEffect(() => {
    async function loadDomains() {
      setDomainsLoading(true);
      try {
        const [domRes, senderRes] = await Promise.all([
          fetch("/api/integrations/postmark/domains"),
          fetch("/api/integrations/postmark/senders"),
        ]);
        if (domRes.ok) {
          const data = await domRes.json();
          setDomains(data?.Domains ?? []);
        }
        if (senderRes.ok) {
          const data = await senderRes.json();
          setSenders(data?.SenderSignatures ?? []);
        }
      } catch {
        // Postmark not configured
      } finally {
        setDomainsLoading(false);
      }
    }
    loadDomains();
  }, []);

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
        const emailParts = (data.fromEmail || "").split("@");
        setFromLocalPart(emailParts[0] || "");
        setFromDomain(emailParts[1] || "");
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

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      toast.error("Please select an HTML file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string") {
        setHtmlBody(content);
        toast.success("HTML imported successfully");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
              {domainsLoading ? (
                <div className="flex items-center gap-2 mt-1 h-9 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading domains...
                </div>
              ) : domains.length > 0 || senders.length > 0 ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    className="w-32"
                    value={fromLocalPart}
                    onChange={(e) => setFromLocalPart(e.target.value)}
                    placeholder="noreply"
                  />
                  <span className="flex items-center text-muted-foreground px-1">@</span>
                  <Select value={fromDomain} onValueChange={setFromDomain}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.length > 0 && (
                        <>
                          {domains.map((d) => (
                            <SelectItem key={`dom-${d.ID}`} value={d.Name}>
                              <span className="flex items-center gap-2">
                                {d.Name}
                                {d.DKIMVerified && d.ReturnPathDomainVerified ? (
                                  <span className="text-xs text-green-600 font-medium">verified</span>
                                ) : (
                                  <span className="text-xs text-amber-600 font-medium">unverified</span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {senders.filter((s) => s.Confirmed && !domains.some((d) => s.Domain === d.Name)).map((s) => {
                        const domain = s.EmailAddress.split("@")[1];
                        return (
                          <SelectItem key={`sender-${s.ID}`} value={domain}>
                            <span className="flex items-center gap-2">
                              {domain}
                              <span className="text-xs text-blue-600 font-medium">sender</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Input
                  className="mt-1"
                  value={fromEmail}
                  onChange={(e) => {
                    const [local, domain] = e.target.value.split("@");
                    setFromLocalPart(local || "");
                    setFromDomain(domain || "");
                  }}
                  placeholder="noreply@example.com"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {fromDomain ? `Will send as: ${fromEmail}` : "Configure Postmark domains in Integrations"}
              </p>
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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={handleImportHtml}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Import HTML
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!htmlBody}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview Email
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Email Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      <strong>Subject:</strong> {fillVariables(subject)}
                    </div>
                    <div className="border rounded-md overflow-auto max-h-[60vh]">
                      <iframe
                        srcDoc={fillVariables(htmlBody)}
                        className="w-full min-h-[400px] border-0"
                        
                        title="Email Preview"
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-2">
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
              <TabsList>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="preview">Live Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="code">
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md min-h-[200px] bg-white">
                  {htmlBody ? (
                    <iframe
                      srcDoc={fillVariables(htmlBody)}
                      className="w-full min-h-[400px] border-0"
                      title="Live HTML Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
                      Enter HTML to see a live preview
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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
