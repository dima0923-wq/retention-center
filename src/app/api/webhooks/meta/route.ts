import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { LeadRouterService } from "@/services/lead-router.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";

function extractFieldData(fieldData: Array<{ name: string; values: string[] }> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return result;
  for (const field of fieldData) {
    if (field.name && Array.isArray(field.values) && field.values.length > 0) {
      result[field.name] = field.values[0];
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret && signature) {
      const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    if (body.object !== "page" || !body.entry) {
      return NextResponse.json({ received: true });
    }

    for (const entry of body.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;

        const leadData = change.value;
        if (!leadData) continue;

        // Meta Lead Ads can send field_data array or flat fields
        const fields = extractFieldData(leadData.field_data);
        const firstName = fields.first_name ?? leadData.first_name ?? leadData.full_name?.split(" ")[0] ?? "Unknown";
        const lastName = fields.last_name ?? leadData.last_name ?? leadData.full_name?.split(" ").slice(1).join(" ") ?? "";
        const email = fields.email ?? leadData.email ?? undefined;
        const phone = fields.phone_number ?? fields.phone ?? leadData.phone_number ?? undefined;

        // Extract UTM params
        const subId = fields.sub_id ?? leadData.sub_id ?? undefined;
        const clickId = fields.click_id ?? leadData.click_id ?? undefined;

        const result = await LeadService.create({
          firstName,
          lastName,
          email,
          phone,
          source: "META",
          externalId: clickId ?? subId ?? leadData.leadgen_id ?? leadData.id ?? undefined,
          meta: { ...leadData, sub_id: subId, click_id: clickId },
        });

        // Auto-assign to matching campaigns and sequences
        if (!result.deduplicated) {
          LeadRouterService.routeNewLead(result.lead.id).catch((err) => {
            console.error("Lead auto-routing failed:", err);
          });

          // Auto-enroll in matching retention sequences (triggerType="new_lead")
          RetentionSequenceService.autoEnrollByTrigger(result.lead.id, "new_lead", "META").catch((err) => {
            console.error("Sequence auto-enrollment failed:", err);
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Meta webhook error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
