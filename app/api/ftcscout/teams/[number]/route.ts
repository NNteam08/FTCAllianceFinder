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

    console.log(`[API Route] Запрос команды ${teamNumber}`);
    const team = await ftcscoutClient.getTeam(teamNumber);
    console.log(`[API Route] Команда получена успешно:`, team);
    return NextResponse.json(team);
  } catch (error: any) {
    console.error("[API Route] Ошибка при получении команды:", error);
    console.error("[API Route] Детали ошибки:", {
      message: error.message,
      statusCode: error.statusCode,
      response: error.response,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: error.message || "Failed to fetch team",
        details: error.response || undefined
      },
      { status: error.statusCode || 500 }
    );
  }
}




