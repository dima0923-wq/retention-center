"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";

type Script = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  campaignId: string | null;
  campaign: { name: string } | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  scripts: Script[];
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

const typeColors: Record<string, string> = {
  CALL: "bg-blue-100 text-blue-800",
  SMS: "bg-green-100 text-green-800",
  EMAIL: "bg-purple-100 text-purple-800",
};

export function ScriptList({ scripts, onDuplicate, onDelete }: Props) {
  if (scripts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No scripts found. Create your first script to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Campaign</TableHead>
          <TableHead>Default</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {scripts.map((script) => (
          <TableRow key={script.id}>
            <TableCell>
              <Link
                href={`/scripts/${script.id}`}
                className="font-medium text-primary hover:underline"
              >
                {script.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={typeColors[script.type] || ""}>
                {script.type}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {script.campaign?.name || "Global"}
            </TableCell>
            <TableCell>
              {script.isDefault && <Badge variant="secondary">Default</Badge>}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(script.updatedAt), "MMM d, yyyy")}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDuplicate(script.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(script.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
