import type { Lead, Conversion } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

async function fireJsonPost(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<{ success: boolean; statusCode?: number; responseBody?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const responseBody = await res.text().catch(() => "");
    if (res.ok) {
      return { success: true, statusCode: res.status, responseBody: responseBody.substring(0, 500) };
    }
    return { success: false, statusCode: res.status, responseBody: responseBody.substring(0, 500), error: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function fireGetRequest(url: string): Promise<{ success: boolean; statusCode?: number; responseBody?: string; error?: string }> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
    const responseBody = await res.text().catch(() => "");
    if (res.ok) {
      return { success: true, statusCode: res.status, responseBody: responseBody.substring(0, 500) };
    }
    return { success: false, statusCode: res.status, responseBody: responseBody.substring(0, 500), error: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function fireWithRetry(
  url: string,
  label: string,
  lead: Lead,
  conversion: Conversion,
  destination: string
): Promise<void> {
  // First attempt
  const first = await fireGetRequest(url);
  await prisma.postbackLog.create({
    data: {
      leadId: lead.id,
      conversionId: conversion.id,
      destination,
      url,
      subId: lead.externalId,
      status: first.success ? "success" : "retry",
      httpStatus: first.statusCode ?? null,
      responseBody: first.responseBody ?? null,
      errorMessage: first.error ?? null,
      retryCount: 0,
    },
  });

  if (!first.success) {
    console.warn(`[OutboundPostback] ${label} attempt 1 failed: ${first.error}. Retrying...`);

    // Retry once
    const retry = await fireGetRequest(url);
    await prisma.postbackLog.create({
      data: {
        leadId: lead.id,
        conversionId: conversion.id,
        destination,
        url,
        subId: lead.externalId,
        status: retry.success ? "success" : "failed",
        httpStatus: retry.statusCode ?? null,
        responseBody: retry.responseBody ?? null,
        errorMessage: retry.error ?? null,
        retryCount: 1,
      },
    });

    if (!retry.success) {
      console.error(`[OutboundPostback] ${label} attempt 2 failed: ${retry.error}. Giving up.`);
    } else {
      console.log(`[OutboundPostback] ${label} succeeded on retry (status ${retry.statusCode}).`);
    }
  } else {
    console.log(`[OutboundPostback] ${label} succeeded on first attempt (status ${first.statusCode}).`);
  }
}

export class OutboundPostbackService {
  /**
   * Called whenever a lead converts via retention effort (status=sale).
   * Fires postbacks to Traffic Center and Keitaro with source=retention tag.
   * All attempts are logged to the PostbackLog table.
   */
  static async sendConversionPostback(lead: Lead, conversion: Conversion): Promise<void> {
    const subid = lead.externalId;
    if (!subid) {
      console.warn(`[OutboundPostback] Lead ${lead.id} has no externalId — skipping postback`);
      return;
    }

    const revenue = conversion.revenue ?? 0;

    // Build Traffic Center postback URL
    const tcBase =
      process.env.TRAFFIC_CENTER_POSTBACK_URL ||
      "https://ag3.q37fh758g.click/api/v1/postback";

    const tcUrl = new URL(tcBase);
    tcUrl.searchParams.set("subid", subid);
    tcUrl.searchParams.set("status", "sale");
    tcUrl.searchParams.set("revenue", revenue.toString());
    tcUrl.searchParams.set("currency", "USD");
    tcUrl.searchParams.set("source", "retention");

    // sub4 = source_type for multi-source attribution (retention_email, retention_sms, retention_call)
    const channel = conversion.channel ?? "unknown";
    tcUrl.searchParams.set("sub4", `retention_${channel}`);
    // sub5 = lead id for lead-level attribution
    tcUrl.searchParams.set("sub5", lead.id);

    // Build Keitaro postback URL
    const keitaroBase = process.env.KEITARO_BASE_URL || "https://keitaro.q37fh758g.click";
    const keitaroUrl = new URL(`${keitaroBase}/72c9314/postback`);
    keitaroUrl.searchParams.set("subid", subid);
    keitaroUrl.searchParams.set("status", "sale");
    keitaroUrl.searchParams.set("payout", revenue.toString());

    // Fire TC + Keitaro postbacks concurrently, each with one retry on failure, both logged to PostbackLog
    await Promise.all([
      fireWithRetry(tcUrl.toString(), `TrafficCenter[lead=${lead.id}]`, lead, conversion, "traffic_center"),
      fireWithRetry(keitaroUrl.toString(), `Keitaro[lead=${lead.id}]`, lead, conversion, "keitaro"),
    ]);

    // Fire Hermes postback async (don't block on failure)
    const hermesUrl = process.env.HERMES_WEBHOOK_URL;
    const hermesSecret = process.env.HERMES_WEBHOOK_SECRET;
    if (hermesUrl && hermesSecret) {
      const hermesStatus = conversion.status === "ftd" ? "ftd" : "lead";
      const hermesPayload = {
        sub_id: subid,
        status: hermesStatus,
        source: "retention",
        source_type: `retention_${channel}`,
        lead_id: lead.id,
        keitaro_campaign_id: lead.campaignId ?? null,
        timestamp: new Date().toISOString(),
      };
      fireJsonPost(hermesUrl, hermesPayload, { "X-Webhook-Secret": hermesSecret })
        .then((result) => {
          if (result.success) {
            console.log(`[OutboundPostback] Hermes[lead=${lead.id}] succeeded (status ${result.statusCode})`);
          } else {
            console.warn(`[OutboundPostback] Hermes[lead=${lead.id}] failed: ${result.error} — non-blocking`);
          }
        })
        .catch((err) => {
          console.warn(`[OutboundPostback] Hermes[lead=${lead.id}] error: ${(err as Error).message} — non-blocking`);
        });
    }

    console.log(
      `[OutboundPostback] lead=${lead.id} conversion=${conversion.id} subid=${subid} revenue=${revenue} — postbacks fired and logged`
    );
  }
}
