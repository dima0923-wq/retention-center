"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

export type Webhook = {
  id: string;
  name: string;
  slug: string;
  type: string;
  sourceLabel: string | null;
  isActive: boolean;
  campaignId: string | null;
  sequenceId: string | null;
  verifyToken: string | null;
  pageAccessToken: string | null;
  fieldMapping: Record<string, string> | null;
  config: Record<string, unknown> | null;
  leadCount: number;
  lastReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; name: string } | null;
  sequence?: { id: string; name: string } | null;
};

const BASE_URL = "https://ag2.q37fh758g.click";

const typeBadgeColors: Record<string, string> = {
  zapier: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  generic: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

function CopyUrlButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${BASE_URL}/api/webhooks/inbound/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Webhook URL copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      title={url}
    >
      <span className="max-w-[180px] truncate">{url}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
      ) : (
        <Copy className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}

export function WebhookList({
  webhooks,
  onEdit,
  onDelete,
  onToggle,
}: {
  webhooks: Webhook[];
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (!webhooks.length) {
    return null;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Sequence</TableHead>
            <TableHead className="text-center">Leads</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {webhooks.map((wh) => (
            <TableRow key={wh.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/webhooks/${wh.id}`}
                  className="hover:underline"
                >
                  {wh.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={typeBadgeColors[wh.type] ?? typeBadgeColors.generic}
                >
                  {wh.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {wh.sourceLabel ?? "—"}
              </TableCell>
              <TableCell>
                <CopyUrlButton slug={wh.slug} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {wh.campaign?.name ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {wh.sequence?.name ?? "—"}
              </TableCell>
              <TableCell className="text-center text-sm">
                {wh.leadCount ?? 0}
              </TableCell>
              <TableCell>
                <Switch
                  checked={wh.isActive}
                  onCheckedChange={(checked) => onToggle(wh.id, checked)}
                />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(wh)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/webhooks/${wh.id}`}>
                        <Activity className="mr-2 h-4 w-4" />
                        View Activity
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(wh)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
