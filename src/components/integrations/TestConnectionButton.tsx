"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type TestState = "idle" | "testing" | "success" | "error";

export function TestConnectionButton({
  provider,
  onResult,
}: {
  provider: string;
  onResult?: (ok: boolean) => void;
}) {
  const [state, setState] = useState<TestState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleTest = async () => {
    setState("testing");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/integrations/${provider}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setState("success");
        onResult?.(true);
      } else {
        setState("error");
        setErrorMsg(data.error ?? "Connection failed");
        onResult?.(false);
      }
    } catch {
      setState("error");
      setErrorMsg("Network error");
      onResult?.(false);
    }
    timeoutRef.current = setTimeout(() => setState("idle"), 3000);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={state === "testing"}
      >
        {state === "testing" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        {state === "success" && <CheckCircle className="mr-2 h-3 w-3 text-emerald-500" />}
        {state === "error" && <XCircle className="mr-2 h-3 w-3 text-red-500" />}
        Test Connection
      </Button>
      {state === "error" && errorMsg && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
    </div>
  );
}
