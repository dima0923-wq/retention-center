import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    const body = await req.json();

    if (body.object !== "page" || !body.entry) {
      return NextResponse.json({ received: true });
    }

    for (const entry of body.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;

        const leadData = change.value;
        if (!leadData) continue;

        await prisma.lead.create({
          data: {
            firstName: leadData.first_name ?? leadData.full_name?.split(" ")[0] ?? "Unknown",
            lastName: leadData.last_name ?? leadData.full_name?.split(" ").slice(1).join(" ") ?? "",
            email: leadData.email ?? undefined,
            phone: leadData.phone_number ?? undefined,
            source: "META",
            externalId: leadData.leadgen_id ?? leadData.id ?? undefined,
            meta: leadData,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
