import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";
import { computeSelfAssessment, type TeamStatsRow } from "@/lib/compatibility/selfAssessment";

/**
 * Самооценка команды: сравнение с другими командами сезона.
 * GET /api/teams/[number]/self-assessment?season=2024
 * season — опционально, по умолчанию текущий FTC-сезон.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const teamNumber = parseInt(params.number);
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");
    const now = new Date();
    const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const season = seasonParam ? parseInt(seasonParam, 10) : currentSeason;
    if (Number.isNaN(season)) {
      return NextResponse.json({ error: "Invalid season" }, { status: 400 });
    }

    const supabase = await createRouteHandlerClientFromRequest(request);

    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: myStatsRow } = await supabase
      .from("quick_stats")
      .select("opr, dpr, ccwm, avg_autonomous, avg_teleop, avg_endgame, matches_played, win_rate")
      .eq("team_id", team.id)
      .eq("season", season)
      .single();

    if (!myStatsRow || myStatsRow.opr == null) {
      return NextResponse.json(
        { error: "No quick stats for this team and season", season },
        { status: 404 }
      );
    }

    const { data: allRows } = await supabase
      .from("quick_stats")
      .select("opr, dpr, ccwm, avg_autonomous, avg_teleop, avg_endgame, matches_played, win_rate")
      .eq("season", season)
      .not("opr", "is", null)
      .limit(1000);

    const allStats: TeamStatsRow[] = (allRows || []).map((r: any) => ({
      opr: Number(r.opr),
      dpr: r.dpr != null ? Number(r.dpr) : null,
      ccwm: r.ccwm != null ? Number(r.ccwm) : null,
      avg_autonomous: Number(r.avg_autonomous ?? 0),
      avg_teleop: r.avg_teleop != null ? Number(r.avg_teleop) : undefined,
      avg_endgame: Number(r.avg_endgame ?? 0),
      matches_played: r.matches_played,
      win_rate: r.win_rate != null ? Number(r.win_rate) : null,
    }));

    const myStats: TeamStatsRow = {
      opr: Number(myStatsRow.opr),
      dpr: myStatsRow.dpr != null ? Number(myStatsRow.dpr) : null,
      ccwm: myStatsRow.ccwm != null ? Number(myStatsRow.ccwm) : null,
      avg_autonomous: Number(myStatsRow.avg_autonomous ?? 0),
      avg_teleop: myStatsRow.avg_teleop != null ? Number(myStatsRow.avg_teleop) : undefined,
      avg_endgame: Number(myStatsRow.avg_endgame ?? 0),
      matches_played: myStatsRow.matches_played,
      win_rate: myStatsRow.win_rate != null ? Number(myStatsRow.win_rate) : null,
    };

    const result = computeSelfAssessment(myStats, allStats, season);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Self-assessment error:", e);
    return NextResponse.json(
      { error: "Failed to compute self-assessment" },
      { status: 500 }
    );
  }
}
