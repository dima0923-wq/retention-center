"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, Globe, Calendar, Clock, Repeat } from "lucide-react";
import { PushMessagePreview } from "@/components/pwa/PushMessagePreview";

type PushMessage = {
  id?: number;
  lang?: string;
  title?: string;
  body?: string;
  image?: { url: string; signed_id: string } | null;
};

type PushSchedule = {
  id?: number;
  schedule_type?: string;
  time?: string | null;
  delay_duration?: number | null;
  days?: string[];
  repeat?: boolean;
  position?: number;
};

type Push = {
  id?: number;
  name?: string;
  active?: boolean;
  archived?: boolean;
  default_lang?: string | null;
  event_id?: string | null;
  custom_click_url?: string | null;
  pwa_ids?: number[];
  messages?: PushMessage[];
  schedules?: PushSchedule[];
};

export default function PushDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [push, setPush] = useState<Push | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPush = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pwa/pushes/${params.id}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to load push campaign");
          return;
        }
        const data = await res.json();
        setPush(data.data?.push ?? null);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchPush();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !push) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error ?? "Push campaign not found"}</p>
        <Button variant="outline" onClick={() => router.push("/pwa/pushes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pushes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/pwa/pushes")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {push.name ?? `Push #${push.id}`}
            </h2>
            <Badge variant={push.active ? "default" : "secondary"}>
              {push.archived ? "Archived" : push.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {push.pwa_ids && push.pwa_ids.length > 0 && (
          <span>Target PWAs: {push.pwa_ids.join(", ")}</span>
        )}
        {push.event_id && <span>Event: {push.event_id}</span>}
        {push.custom_click_url && <span>Click URL: {push.custom_click_url}</span>}
      </div>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-4 w-4" />
            Messages ({push.messages?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!push.messages || push.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages configured.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {push.messages.map((msg) => (
                <div key={msg.id ?? msg.lang} className="space-y-2">
                  <Badge variant="outline" className="text-xs">
                    {msg.lang?.toUpperCase() ?? "?"}
                    {msg.lang === push.default_lang && " (default)"}
                  </Badge>
                  <PushMessagePreview
                    title={msg.title ?? ""}
                    text={msg.body ?? ""}
                    image={msg.image?.url}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-4 w-4" />
            Schedules ({push.schedules?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!push.schedules || push.schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schedules configured.</p>
          ) : (
            <div className="space-y-3">
              {push.schedules.map((sched, idx) => (
                <div key={sched.id ?? idx} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                    <Clock className="h-4 w-4 text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {sched.schedule_type ?? "Unknown"}
                      </span>
                      {sched.repeat && (
                        <Badge variant="outline" className="text-xs">
                          <Repeat className="h-3 w-3 mr-1" />
                          Repeat
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                      {sched.time && <span>Time: {sched.time}</span>}
                      {sched.delay_duration != null && <span>Delay: {sched.delay_duration}min</span>}
                      {sched.days && sched.days.length > 0 && (
                        <span>Days: {sched.days.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
