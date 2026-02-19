"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Mail } from "lucide-react";
import type { EmailStep } from "./EmailTemplateEditor";

const SAMPLE_DATA: Record<string, string> = {
  firstName: "John",
  lastName: "Doe",
  phone: "+1 555-0123",
  email: "john.doe@example.com",
  companyName: "Acme Corp",
};

function renderTemplate(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return SAMPLE_DATA[key] ?? match;
  });
}

type Props =
  | { type: "SMS"; content: string; steps?: never; subject?: never }
  | { type: "CALL"; content: string; steps?: never; subject?: never }
  | { type: "EMAIL"; steps: EmailStep[]; content?: never; subject?: never };

export function ScriptPreview(props: Props) {
  if (props.type === "EMAIL") {
    return <EmailSequencePreview steps={props.steps} />;
  }

  const rendered = renderTemplate(props.content);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Preview (with sample data)</CardTitle>
      </CardHeader>
      <CardContent>
        {props.type === "SMS" && (
          <div className="mb-2 text-xs text-muted-foreground">
            {rendered.length} / 160 characters
            {rendered.length > 160 && ` (${Math.ceil(rendered.length / 153)} segments)`}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
          {rendered}
        </div>
      </CardContent>
    </Card>
  );
}

function EmailSequencePreview({ steps }: { steps: EmailStep[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Email Sequence Preview ({steps.length} step{steps.length !== 1 ? "s" : ""})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => {
          const renderedSubject = renderTemplate(step.subject);
          const renderedBody = renderTemplate(step.body);

          return (
            <div key={index}>
              {index > 0 && (
                <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    Wait {step.delay_days} day{step.delay_days !== 1 ? "s" : ""}
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 border-b">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    Step {index + 1}
                  </Badge>
                </div>
                {renderedSubject && (
                  <div className="px-4 py-2 border-b">
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="text-sm font-medium">{renderedSubject}</p>
                  </div>
                )}
                <div className="px-4 py-3">
                  <div className="text-sm whitespace-pre-wrap">
                    {renderedBody || (
                      <span className="text-muted-foreground italic">No body content</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
