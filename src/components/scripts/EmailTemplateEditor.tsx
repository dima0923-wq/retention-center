"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TemplateVariableInserter } from "./TemplateVariableInserter";
import { ScriptPreview } from "./ScriptPreview";
import { useRef } from "react";

type Props = {
  subject: string;
  body: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
};

export function EmailTemplateEditor({ subject, body, onSubjectChange, onBodyChange }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      onBodyChange(body + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    onBodyChange(newBody);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Subject</Label>
        <Input
          className="mt-1"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Re: Your inquiry, {{firstName}}"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Body (HTML)</Label>
          <TemplateVariableInserter onInsert={handleInsertVariable} />
        </div>
        <Textarea
          ref={bodyRef}
          rows={12}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="<p>Hi {{firstName}},</p><p>...</p>"
          className="font-mono text-sm"
        />
      </div>
      {(subject || body) && (
        <ScriptPreview content={body} type="EMAIL" subject={subject} />
      )}
    </div>
  );
}
