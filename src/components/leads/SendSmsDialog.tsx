"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Script = {
  id: string;
  name: string;
  content: string | null;
};

type SendSmsDialogProps = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const TEMPLATE_VARS = ["{{firstName}}", "{{lastName}}", "{{phone}}", "{{email}}"];

function replaceVariables(template: string, lead: SendSmsDialogProps["lead"]): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

export function SendSmsDialog({ lead, open, onOpenChange, onSuccess }: SendSmsDialogProps) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = message.length;
  const isOverLimit = charCount > 160;

  // Fetch SMS scripts when dialog opens
  useEffect(() => {
    if (!open) return;
    setMessage("");
    setSelectedScriptId("");

    fetch("/api/scripts?type=SMS")
      .then((res) => res.json())
      .then((data) => setScripts(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => setScripts([]));
  }, [open]);

  const handleScriptSelect = useCallback(
    (scriptId: string) => {
      setSelectedScriptId(scriptId);
      if (scriptId === "none") {
        setMessage("");
        return;
      }
      const script = scripts.find((s) => s.id === scriptId);
      if (script?.content) {
        setMessage(replaceVariables(script.content, lead));
      }
    },
    [scripts, lead]
  );

  const insertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setMessage((prev) => prev.slice(0, start) + variable + prev.slice(end));
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  }, []);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setSending(true);
    try {
      const body: { message: string; scriptId?: string } = { message };
      if (selectedScriptId && selectedScriptId !== "none") {
        body.scriptId = selectedScriptId;
      }

      const res = await fetch(`/api/leads/${lead.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send SMS");
        return;
      }

      const data = await res.json();

      if (data.success) {
        toast.success("SMS sent successfully");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(data.error || "Failed to send SMS");
      }
    } catch {
      toast.error("Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS to {lead.firstName} {lead.lastName}</DialogTitle>
          <DialogDescription>
            Compose and send an SMS message to this lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone display */}
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{lead.phone}</span>
          </div>

          {/* Script selector */}
          {scripts.length > 0 && (
            <div className="space-y-1">
              <Label>Template (optional)</Label>
              <Select value={selectedScriptId || "none"} onValueChange={handleScriptSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an SMS template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {scripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Message textarea */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <span
                className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}
              >
                {charCount}/160
                {isOverLimit && " (may be split into multiple SMS)"}
              </span>
            </div>
            <Textarea
              ref={textareaRef}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
            />
          </div>

          {/* Template variable buttons */}
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_VARS.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => insertVariable(v)}
              >
                {v}
              </Badge>
            ))}
          </div>

          {/* Send button */}
          <Button
            className="w-full"
            onClick={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
