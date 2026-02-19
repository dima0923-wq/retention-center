"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MessageSquare } from "lucide-react";
import { format } from "date-fns";
type ContactAttempt = {
  id: string;
  channel: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  notes: string | null;
};

const channelIcons: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <MessageSquare className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  NO_ANSWER: "bg-yellow-100 text-yellow-800",
};

export function LeadTimeline({ attempts }: { attempts: ContactAttempt[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Contact History</CardTitle>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contact attempts yet.</p>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="flex gap-3 items-start">
                <div className="mt-1 p-2 rounded-full bg-muted">
                  {channelIcons[attempt.channel] || <Phone className="h-4 w-4" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{attempt.channel}</span>
                    <Badge variant="outline" className={statusColors[attempt.status] || ""}>
                      {attempt.status.replace("_", " ")}
                    </Badge>
                    {attempt.duration != null && (
                      <span className="text-xs text-muted-foreground">
                        {Math.floor(attempt.duration / 60)}m {attempt.duration % 60}s
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(attempt.startedAt), "MMM d, yyyy HH:mm")}
                  </p>
                  {attempt.notes && (
                    <p className="text-sm text-muted-foreground">{attempt.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
