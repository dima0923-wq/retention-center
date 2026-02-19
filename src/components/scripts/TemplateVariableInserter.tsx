"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Variable } from "lucide-react";

const VARIABLES = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Company Name" },
];

type Props = {
  onInsert: (variable: string) => void;
};

export function TemplateVariableInserter({ onInsert }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Variable className="h-4 w-4 mr-1" />
          Insert Variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {VARIABLES.map((v) => (
          <DropdownMenuItem key={v.key} onClick={() => onInsert(`{{${v.key}}}`)}>
            {v.label} — <code className="ml-1 text-xs">{`{{${v.key}}}`}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
