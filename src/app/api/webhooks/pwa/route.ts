import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setLeadUgid } from "@/lib/pwa-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { ugid, email, phone, pwaId, event } = body as {
      ugid?: string;
      email?: string;
      phone?: string;
      pwaId?: number;
      event?: string;
    };

    if (!ugid) {
      return NextResponse.json({ error: "ugid is required" }, { status: 400 });
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: "email or phone is required to match a lead" },
        { status: 400 }
      );
    }

    // Find lead by email or phone
    const lead = await prisma.lead.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!lead) {
      return NextResponse.json(
        { matched: false, message: "No matching lead found" },
        { status: 200 }
      );
    }

    await setLeadUgid(lead.id, ugid, pwaId);

    console.log(
      `PWA webhook: linked ugid=${ugid} to lead=${lead.id} (event=${event || "unknown"})`
    );

    return NextResponse.json({
      matched: true,
      leadId: lead.id,
      ugid,
    });
  } catch (error) {
    console.error("POST /api/webhooks/pwa error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
