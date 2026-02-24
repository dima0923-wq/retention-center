import { NextRequest, NextResponse } from "next/server";
import { PushService, PushServiceError } from "@/services/channel/push.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:pwa:manage");

    const body = await req.json();
    const { userIds, internalName, title, text, image } = body;

    if (!userIds?.length || !internalName || !title || !text) {
      return NextResponse.json(
        { error: "Missing required fields: userIds, internalName, title, text" },
        { status: 400 },
      );
    }

    if (!Array.isArray(userIds) || !userIds.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json(
        { error: "userIds must be an array of strings" },
        { status: 400 },
      );
    }

    const result = await PushService.sendInstantPush({
      userIds,
      internalName,
      title,
      text,
      image,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ result: "success", data: result });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof PushServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 502 },
      );
    }
    console.error("POST /api/pwa/push/instant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
