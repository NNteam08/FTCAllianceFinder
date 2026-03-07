import { NextRequest, NextResponse } from "next/server";
import { ftcscoutClient } from "@/lib/ftcscout/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const teamNumber = parseInt(params.number);
    
    if (isNaN(teamNumber)) {
      return NextResponse.json(
        { error: "Invalid team number" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season")
      ? parseInt(searchParams.get("season")!)
      : undefined;

    const events = await ftcscoutClient.getTeamEvents(teamNumber, season);
    
    return NextResponse.json(events);
  } catch (error: any) {
    console.error("Error fetching team events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch team events" },
      { status: error.statusCode || 500 }
    );
  }
}




