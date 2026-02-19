import { NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET() {
  try {
    const data = await LearningService.getRecommendations();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
