import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Handle ping/verification requests
    if (!data || (!data.id && !data.status)) {
      return NextResponse.json({ success: true });
    }

    const { id, status } = data as { id: number; status: string };

    // Look up the contact attempt by provider ref
    const attempt = await prisma.contactAttempt.findFirst({
      where: {
        providerRef: String(id),
        provider: "sms-retail",
      },
    });

    if (attempt) {
      const newStatus = status === "delivered" ? "SUCCESS" : "FAILED";
      await prisma.contactAttempt.update({
        where: { id: attempt.id },
        data: {
          status: newStatus,
          completedAt: new Date(),
          result: JSON.stringify(data),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
