import { NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET() {
  try {
    const data = await LearningService.getChannelMixAnalysis();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Channel mix error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel mix analysis" },
      { status: 500 }
    );
  }
}
