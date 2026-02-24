"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PushMessagePreview } from "./PushMessagePreview";

export function InstantPushDialog() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [userIds, setUserIds] = useState("");
  const [internalName, setInternalName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState("");

  const reset = () => {
    setUserIds("");
    setInternalName("");
    setTitle("");
    setText("");
    setImage("");
  };

  const handleSend = async () => {
    const ids = userIds
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      toast.error("Enter at least one user ID");
      return;
    }
    if (!internalName.trim()) {
      toast.error("Internal name is required");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!text.trim()) {
      toast.error("Text is required");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/pwa/push/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: ids,
          internalName: internalName.trim(),
          title: title.trim(),
          text: text.trim(),
          ...(image.trim() ? { image: image.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send push");
        return;
      }

      toast.success(`Push sent to ${ids.length} user${ids.length !== 1 ? "s" : ""}`);
      reset();
      setOpen(false);
    } catch {
      toast.error("Network error sending push");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          Send Instant Push
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Instant Push Notification</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User IDs</Label>
              <Textarea
                placeholder="Enter PwaFlow user IDs (one per line or comma-separated)"
                value={userIds}
                onChange={(e) => setUserIds(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                PwaFlow ugids from lead meta data.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Internal Name</Label>
              <Input
                placeholder="e.g., promo-2026-02"
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Text</Label>
              <Textarea
                placeholder="Notification body text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                placeholder="https://..."
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Preview</Label>
            <PushMessagePreview title={title} text={text} image={image || undefined} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Push
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
