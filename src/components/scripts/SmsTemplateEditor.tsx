"use client";

import { Textarea } from "@/components/ui/textarea";
import { TemplateVariableInserter } from "./TemplateVariableInserter";
import { ScriptPreview } from "./ScriptPreview";
import { useRef } from "react";

type Props = {
  content: string;
  onChange: (content: string) => void;
};

export function SmsTemplateEditor({ content, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(content + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + variable + content.slice(end);
    onChange(newContent);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {content.length} / 160 characters
          </p>
        </div>
        <TemplateVariableInserter onInsert={handleInsertVariable} />
      </div>
      <Textarea
        ref={textareaRef}
        rows={6}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hi {{firstName}}, ..."
      />
      {content && <ScriptPreview content={content} type="SMS" />}
    </div>
  );
}
