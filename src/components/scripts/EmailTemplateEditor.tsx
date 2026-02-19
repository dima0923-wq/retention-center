"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateVariableInserter } from "./TemplateVariableInserter";
import { ScriptPreview } from "./ScriptPreview";
import { useRef, useCallback } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Mail } from "lucide-react";

export type EmailStep = {
  subject: string;
  body: string;
  delay_days: number;
};

type Props = {
  steps: EmailStep[];
  onStepsChange: (steps: EmailStep[]) => void;
};

export function EmailTemplateEditor({ steps, onStepsChange }: Props) {
  const bodyRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const subjectRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const updateStep = useCallback(
    (index: number, field: keyof EmailStep, value: string | number) => {
      const updated = steps.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      onStepsChange(updated);
    },
    [steps, onStepsChange]
  );

  const addStep = () => {
    onStepsChange([
      ...steps,
      { subject: "", body: "", delay_days: steps.length === 0 ? 0 : 1 },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    onStepsChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onStepsChange(updated);
  };

  const handleInsertVariable = (index: number, target: "subject" | "body", variable: string) => {
    if (target === "body") {
      const textarea = bodyRefs.current.get(index);
      if (!textarea) {
        updateStep(index, "body", steps[index].body + variable);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = steps[index].body;
      const newBody = current.slice(0, start) + variable + current.slice(end);
      updateStep(index, "body", newBody);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    } else {
      const input = subjectRefs.current.get(index);
      if (!input) {
        updateStep(index, "subject", steps[index].subject + variable);
        return;
      }
      const start = input.selectionStart ?? steps[index].subject.length;
      const end = input.selectionEnd ?? start;
      const current = steps[index].subject;
      const newSubject = current.slice(0, start) + variable + current.slice(end);
      updateStep(index, "subject", newSubject);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + variable.length;
        input.focus();
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Step {index + 1}
                {index === 0 ? " (Initial Email)" : ` (Follow-up after ${step.delay_days} day${step.delay_days !== 1 ? "s" : ""})`}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {index > 0 && (
              <div>
                <Label>Delay (days after previous step)</Label>
                <Input
                  className="mt-1 w-32"
                  type="number"
                  min={1}
                  value={step.delay_days}
                  onChange={(e) =>
                    updateStep(index, "delay_days", Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Subject</Label>
                <TemplateVariableInserter
                  onInsert={(v) => handleInsertVariable(index, "subject", v)}
                />
              </div>
              <Input
                ref={(el) => {
                  if (el) subjectRefs.current.set(index, el);
                  else subjectRefs.current.delete(index);
                }}
                className="mt-1"
                value={step.subject}
                onChange={(e) => updateStep(index, "subject", e.target.value)}
                placeholder="Re: Your inquiry, {{firstName}}"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Body</Label>
                <TemplateVariableInserter
                  onInsert={(v) => handleInsertVariable(index, "body", v)}
                />
              </div>
              <Textarea
                ref={(el) => {
                  if (el) bodyRefs.current.set(index, el);
                  else bodyRefs.current.delete(index);
                }}
                rows={8}
                value={step.body}
                onChange={(e) => updateStep(index, "body", e.target.value)}
                placeholder="Hi {{firstName}},&#10;&#10;Thank you for your interest..."
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addStep} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Step
      </Button>

      {steps.some((s) => s.subject || s.body) && (
        <ScriptPreview type="EMAIL" steps={steps} />
      )}
    </div>
  );
}
