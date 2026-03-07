import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";
import { ftcscoutClient } from "@/lib/ftcscout/client";

/**
 * Массовое обновление данных всех команд из FTCScout
 * GET /api/admin/teams/sync-all?season=2025&limit=100&offset=0&dryRun=1
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    
    // Проверка авторизации (можно добавить проверку роли admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const dryRun = searchParams.get("dryRun") === "1";

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const season = seasonParam ? parseInt(seasonParam, 10) : currentYear;
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Получаем список всех команд из БД
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, number")
      .order("number")
      .range(offset, offset + limit - 1);

    if (teamsError) {
      throw teamsError;
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No teams found",
        stats: { processed: 0, updated: 0, errors: 0 },
      });
    }

    const stats = {
      processed: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
    };

    const errors: Array<{ teamNumber: number; error: string }> = [];

    // Обновляем каждую команду
    for (const team of teams) {
      try {
        stats.processed++;

        // Получаем данные команды из FTCScout
        let teamData: any = null;
        try {
          teamData = await ftcscoutClient.getTeam(team.number);
        } catch (e: any) {
          if (e.statusCode === 404) {
            stats.skipped++;
            continue; // Команда не найдена в FTCScout
          }
          throw e;
        }

        // Обновляем основную информацию команды
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("teams")
            .update({
              name: teamData.name || `Team ${team.number}`,
              region: teamData.region || null,
              rookie_year: teamData.rookieYear || null,
            })
            .eq("id", team.id);

          if (updateError) throw updateError;
        }

        // Получаем статистику: если указан season - только его, иначе текущий + предыдущий
        const seasonsToSync = seasonParam ? [season] : [currentYear, previousYear];
        
        for (const seasonNum of seasonsToSync) {
          try {
            const quickStats = await ftcscoutClient.getTeamQuickStats(team.number, seasonNum);
            
            if (!dryRun) {
              const toNumOrNull = (v: unknown) => {
                const n = v != null && v !== "" ? Number(v) : undefined;
                return n != null && !Number.isNaN(n) ? n : null;
              };

              const { error: statsError } = await supabase
                .from("quick_stats")
                .upsert({
                  team_id: team.id,
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

              if (statsError) throw statsError;
            }

            stats.updated++;
          } catch (e: any) {
            // Игнорируем ошибки 404 для статистики (команда может не иметь данных за этот сезон)
            if (e.statusCode !== 404) {
              errors.push({ teamNumber: team.number, error: `Stats ${seasonNum}: ${e.message}` });
              stats.errors++;
            }
          }
        }
      } catch (error: any) {
        errors.push({ teamNumber: team.number, error: error.message || String(error) });
        stats.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      message: dryRun 
        ? `Would update ${stats.updated} teams (dry run)` 
        : `Updated ${stats.updated} teams successfully`,
    });
  } catch (error: any) {
    console.error("Error syncing teams:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync teams" },
      { status: 500 }
    );
  }
}
