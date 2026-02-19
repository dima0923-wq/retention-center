"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type Props = {
  content: string;
  type: "SMS" | "EMAIL" | "CALL";
  subject?: string;
};

export function ScriptPreview({ content, type, subject }: Props) {
  const rendered = renderTemplate(content);
  const renderedSubject = subject ? renderTemplate(subject) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Preview (with sample data)</CardTitle>
      </CardHeader>
      <CardContent>
        {type === "EMAIL" && renderedSubject && (
          <div className="mb-3 pb-3 border-b">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-medium">{renderedSubject}</p>
          </div>
        )}
        {type === "SMS" && (
          <div className="mb-2 text-xs text-muted-foreground">
            {rendered.length} / 160 characters
            {rendered.length > 160 && ` (${Math.ceil(rendered.length / 153)} segments)`}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
          {type === "EMAIL" ? (
            <div dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            rendered
          )}
        </div>
      </CardContent>
    </Card>
  );
}
