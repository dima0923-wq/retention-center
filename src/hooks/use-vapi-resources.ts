"use client";

import { useState, useEffect, useCallback } from "react";

export type VapiAssistant = {
  id: string;
  name: string;
  model?: string | null;
  modelProvider?: string | null;
  temperature?: number | null;
  voiceProvider?: string | null;
  voiceId?: string | null;
  firstMessage?: string | null;
  instructions?: string | null;
};
export type VapiPhoneNumber = { id: string; number: string; provider?: string; name?: string };
export type VapiVoice = { id: string; name: string; provider: string };

type VapiResourcesOptions = {
  /** Only fetch when this is true (default: true) */
  enabled?: boolean;
  /** Which resources to fetch (default: all) */
  include?: ("assistants" | "phoneNumbers" | "voices")[];
};

type VapiResourcesResult = {
  assistants: VapiAssistant[];
  phoneNumbers: VapiPhoneNumber[];
  voices: VapiVoice[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useVapiResources(
  options: VapiResourcesOptions = {}
): VapiResourcesResult {
  const { enabled = true, include } = options;

  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [voices, setVoices] = useState<VapiVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldFetch = useCallback(
    (resource: "assistants" | "phoneNumbers" | "voices") =>
      !include || include.includes(resource),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [include?.join(",")]
  );

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetches: Promise<void>[] = [];

    if (shouldFetch("assistants")) {
      fetches.push(
        fetch("/api/integrations/vapi/assistants")
          .then(async (r) => {
            if (!r.ok) throw new Error("Failed to load assistants");
            const data = await r.json();
            setAssistants(Array.isArray(data) ? data : (data.assistants ?? data.data ?? []));
          })
          .catch(() => {
            setAssistants([]);
          })
      );
    }

    if (shouldFetch("phoneNumbers")) {
      fetches.push(
        fetch("/api/integrations/vapi/phone-numbers")
          .then(async (r) => {
            if (!r.ok) throw new Error("Failed to load phone numbers");
            const data = await r.json();
            setPhoneNumbers(Array.isArray(data) ? data : (data.phoneNumbers ?? data.data ?? []));
          })
          .catch(() => {
            setPhoneNumbers([]);
          })
      );
    }

    if (shouldFetch("voices")) {
      fetches.push(
        fetch("/api/integrations/vapi/voices")
          .then(async (r) => {
            if (!r.ok) throw new Error("Failed to load voices");
            const data = await r.json();
            setVoices(Array.isArray(data) ? data : (data.voices ?? data.data ?? []));
          })
          .catch(() => {
            setVoices([]);
          })
      );
    }

    try {
      await Promise.all(fetches);
    } catch {
      setError("Failed to load VAPI resources");
    } finally {
      setLoading(false);
    }
  }, [shouldFetch]);

  useEffect(() => {
    if (enabled) {
      fetchResources();
    }
  }, [enabled, fetchResources]);

  return {
    assistants,
    phoneNumbers,
    voices,
    loading,
    error,
    refresh: fetchResources,
  };
}
