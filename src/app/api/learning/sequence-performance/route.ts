import { NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET() {
  try {
    const data = await LearningService.getSequencePerformance();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Sequence performance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence performance" },
      { status: 500 }
    );
  }
}
