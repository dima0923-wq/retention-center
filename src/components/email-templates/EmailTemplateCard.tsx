"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  trigger: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  template: EmailTemplate;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

const triggerLabels: Record<string, string> = {
  manual: "Manual",
  new_lead: "New Lead",
  conversion: "Conversion",
  custom: "Custom",
};

export function EmailTemplateCard({ template, onDuplicate, onDelete }: Props) {
  return (
    <Card className="group relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/email-templates/${template.id}`} className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold hover:underline truncate">
              {template.name}
            </CardTitle>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(template.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground truncate">
          {template.subject || "No subject"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">
            {triggerLabels[template.trigger] || template.trigger}
          </Badge>
          <Badge variant={template.isActive ? "default" : "secondary"}>
            {template.isActive ? "Active" : "Inactive"}
          </Badge>
          {template.isDefault && <Badge variant="secondary">Default</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {format(new Date(template.updatedAt), "MMM d, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}
