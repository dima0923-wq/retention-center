"use client";

import { useState } from "react";
import Link from "next/link";
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
import { ChevronDown, ChevronRight } from "lucide-react";

export type DeliveryEvent = {
  id: string;
  contactAttemptId: string;
  providerRef: string;
  provider: string;
  status: string;
  rawStatus: string;
  receivedAt: string;
  ip: string | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
};

type AttemptDetail = {
  attempt: {
    id: string;
    leadId: string;
    channel: string;
    status: string;
    provider: string;
    providerRef: string;
    startedAt: string;
    completedAt: string | null;
    lead: { firstName: string; lastName: string; phone: string };
  };
  events: {
    id: string;
    status: string;
    rawStatus: string;
    rawPayload: string;
    receivedAt: string;
    ip: string | null;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  UNDELIVERED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  UNKNOWN: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function DeliveryLogTable({ events }: { events: DeliveryEvent[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleRowClick = async (event: DeliveryEvent) => {
    if (expandedRow === event.id) {
      setExpandedRow(null);
      setAttemptDetail(null);
      return;
    }

    setExpandedRow(event.id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/sms-delivery-log/${event.contactAttemptId}`);
      if (res.ok) {
        setAttemptDetail(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch attempt detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (events.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Time</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Raw Status</TableHead>
            <TableHead>Provider Ref</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
              No delivery events found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Time</TableHead>
          <TableHead>Lead</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Raw Status</TableHead>
          <TableHead>Provider Ref</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <>
            <TableRow
              key={event.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(event)}
            >
              <TableCell className="px-2">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {expandedRow === event.id ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {new Date(event.receivedAt).toLocaleDateString()}{" "}
                {new Date(event.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </TableCell>
              <TableCell className="text-sm">
                {event.lead ? (
                  <Link
                    href={`/leads/${event.lead.id}`}
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {event.lead.firstName} {event.lead.lastName}
                  </Link>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-xs font-mono">
                {event.lead?.phone || "-"}
              </TableCell>
              <TableCell className="text-xs">{event.provider}</TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[event.status] ?? ""}
                >
                  {event.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {event.rawStatus}
              </TableCell>
              <TableCell className="text-xs font-mono">
                {event.providerRef}
              </TableCell>
            </TableRow>
            {expandedRow === event.id && (
              <TableRow key={`${event.id}-detail`}>
                <TableCell colSpan={8} className="bg-muted/30 p-4">
                  {loadingDetail ? (
                    <p className="text-sm text-muted-foreground">Loading details...</p>
                  ) : attemptDetail ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>IP: {event.ip || "N/A"}</span>
                        <span>Attempt Status: {attemptDetail.attempt.status}</span>
                        <span>Started: {new Date(attemptDetail.attempt.startedAt).toLocaleString()}</span>
                        {attemptDetail.attempt.completedAt && (
                          <span>Completed: {new Date(attemptDetail.attempt.completedAt).toLocaleString()}</span>
                        )}
                      </div>
                      {attemptDetail.events.length > 1 && (
                        <div>
                          <p className="text-xs font-medium mb-2">All Events for this Attempt:</p>
                          <div className="space-y-1">
                            {attemptDetail.events.map((e) => (
                              <div key={e.id} className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {new Date(e.receivedAt).toLocaleString()}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${STATUS_COLORS[e.status] ?? ""}`}
                                >
                                  {e.status}
                                </Badge>
                                <span className="text-muted-foreground">({e.rawStatus})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {attemptDetail.events.find((e) => e.id === event.id)?.rawPayload && (
                        <div>
                          <p className="text-xs font-medium mb-1">Raw Payload:</p>
                          <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto max-h-40">
                            {(() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(
                                    attemptDetail.events.find((e) => e.id === event.id)?.rawPayload || "{}"
                                  ),
                                  null,
                                  2
                                );
                              } catch {
                                return attemptDetail.events.find((e) => e.id === event.id)?.rawPayload || "{}";
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Failed to load details</p>
                  )}
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
