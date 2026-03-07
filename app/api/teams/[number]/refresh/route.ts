import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";
import { ftcscoutClient } from "@/lib/ftcscout/client";

/**
 * Обновить данные команды из FTCScout
 * POST /api/teams/[number]/refresh
 */
/**
 * Обновить данные команды из FTCScout.
 * Не требует авторизации — публичные данные.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const teamNumber = parseInt(params.number);
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    const supabase = await createRouteHandlerClientFromRequest(request);

    // Получаем данные команды из FTCScout
    let teamData: any = null;
    try {
      teamData = await ftcscoutClient.getTeam(teamNumber);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return NextResponse.json({ error: "Team not found in FTCScout" }, { status: 404 });
      }
      throw e;
    }

    // Находим или создаем команду в БД
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    let teamId: string;

    if (existingTeam) {
      teamId = existingTeam.id;
      // Обновляем основную информацию
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: teamData.name || `Team ${teamNumber}`,
          region: teamData.region || null,
          rookie_year: teamData.rookieYear || null,
        })
        .eq("id", teamId);

      if (updateError) throw updateError;
    } else {
      // Создаем новую команду
      const { data: newTeam, error: insertError } = await supabase
        .from("teams")
        .insert({
          number: teamNumber,
          name: teamData.name || `Team ${teamNumber}`,
          region: teamData.region || null,
          rookie_year: teamData.rookieYear || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      teamId = newTeam.id;
    }

    // Обновляем статистику за текущий и предыдущий сезон
    // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
    const now = new Date();
    const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const previousSeason = currentSeason - 1;
    const seasonsToSync = [currentSeason, previousSeason];

    const updatedSeasons: number[] = [];

    for (const seasonNum of seasonsToSync) {
      try {
        const quickStats = await ftcscoutClient.getTeamQuickStats(teamNumber, seasonNum);
        
        const toNumOrNull = (v: unknown) => {
          const n = v != null && v !== "" ? Number(v) : undefined;
          return n != null && !Number.isNaN(n) ? n : null;
        };

        const { error: statsError } = await supabase
          .from("quick_stats")
          .upsert({
            team_id: teamId,
            season: seasonNum,
            region: quickStats.region || null,
            opr: toNumOrNull(quickStats.OPR),
            dpr: toNumOrNull(quickStats.DPR),
            ccwm: toNumOrNull(quickStats.CCWM),
            avg_autonomous: toNumOrNull(quickStats.avgAutonomous),
            avg_teleop: toNumOrNull(quickStats.avgTeleop),
            avg_endgame: toNumOrNull(quickStats.avgEndgame),
            matches_played: Math.max(0, Math.floor(quickStats.matchesPlayed || 0)),
            win_rate: toNumOrNull(quickStats.winRate),
            ftcscout_synced_at: new Date().toISOString(),
          }, {
            onConflict: "team_id,season",
          });

        if (!statsError) {
          updatedSeasons.push(seasonNum);
        }
      } catch (e: any) {
        // Игнорируем ошибки 404 для статистики (команда может не иметь данных за этот сезон)
        if (e.statusCode !== 404) {
          console.error(`Error updating stats for season ${seasonNum}:`, e);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Team data refreshed",
      updatedSeasons,
    });
  } catch (error: any) {
    console.error("Error refreshing team:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh team data" },
      { status: 500 }
    );
  }
}
