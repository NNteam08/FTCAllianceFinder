/**
 * Синхронизация данных команды из FTCScout — та же логика, что при поиске.
 * Вызывается и при поиске на /teams, и при обновлении на /teams/[number].
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeQuickStats } from "@/lib/ftcscout/normalize";

const FTCSCOUT_BASE = "/api/ftcscout";

function toRowFromNormalized(
  norm: { OPR: number | null; DPR?: number | null; CCWM?: number | null; avgAutonomous: number | null; avgTeleop: number | null; avgEndgame: number | null; matchesPlayed: number; winRate: number | null; region: string },
  teamId: string,
  season: number
) {
  const toNumOrNull = (v: number | null | undefined) =>
    v != null && typeof v === "number" && !Number.isNaN(v) ? v : null;
  return {
    team_id: teamId,
    season,
    region: (norm.region as string) || null,
    opr: toNumOrNull(norm.OPR),
    dpr: toNumOrNull(norm.DPR),
    ccwm: toNumOrNull(norm.CCWM),
    avg_autonomous: toNumOrNull(norm.avgAutonomous),
    avg_teleop: toNumOrNull(norm.avgTeleop),
    avg_endgame: toNumOrNull(norm.avgEndgame),
    matches_played: Math.max(0, Math.floor(norm.matchesPlayed || 0)),
    win_rate: toNumOrNull(norm.winRate),
    ftcscout_synced_at: new Date().toISOString(),
  };
}

export async function syncTeamFromFtcScout(
  teamNumber: number,
  supabase: SupabaseClient,
  options?: { timeoutMs?: number }
): Promise<{ success: boolean; notFound?: boolean; error?: string; statsSaved?: number }> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOpts: RequestInit = {
    cache: "no-store",
    signal: controller.signal,
  };

  try {
    const teamRes = await fetch(`${FTCSCOUT_BASE}/teams/${teamNumber}`, fetchOpts);
    if (teamRes.status === 404) {
      return { success: false, notFound: true };
    }
    if (!teamRes.ok) {
      const err = await teamRes.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch team");
    }

    const teamData = await teamRes.json();
    const name = teamData.name ?? teamData.team_name ?? teamData.nickname ?? `Team ${teamNumber}`;
    const region = teamData.region ?? teamData.region_key ?? teamData.Region ?? null;
    const rookieYear = teamData.rookieYear ?? teamData.rookie_year ?? null;

    const now = new Date();
    const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const previousSeason = currentSeason - 1;

    let statsCurrent: ReturnType<typeof normalizeQuickStats> = null;
    let statsPrev: ReturnType<typeof normalizeQuickStats> = null;

    const [rCur, rPrev] = await Promise.all([
      fetch(`${FTCSCOUT_BASE}/teams/${teamNumber}/quick-stats?season=${currentSeason}`, fetchOpts),
      fetch(`${FTCSCOUT_BASE}/teams/${teamNumber}/quick-stats?season=${previousSeason}`, fetchOpts),
    ])
    if (rCur.ok) {
      try {
        const d = await rCur.json().catch(() => null);
        statsCurrent = normalizeQuickStats(d, teamNumber, currentSeason);
      } catch { /* ignore */ }
    }
    if (rPrev.ok) {
      try {
        const d = await rPrev.json().catch(() => null);
        statsPrev = normalizeQuickStats(d, teamNumber, previousSeason);
      } catch { /* ignore */ }
    }

    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    let teamId: string;

    if (existingTeam) {
      teamId = existingTeam.id;
      await supabase
        .from("teams")
        .update({ name, region, rookie_year: rookieYear })
        .eq("id", teamId);
    } else {
      const { data: newTeam, error: insErr } = await supabase
        .from("teams")
        .insert({ number: teamNumber, name, region, rookie_year: rookieYear })
        .select("id")
        .single();
      if (insErr || !newTeam) throw new Error(insErr?.message || "Failed to create team");
      teamId = newTeam!.id;
    }

    let statsSaved = 0;
    if (statsCurrent) {
      await supabase
        .from("quick_stats")
        .upsert(toRowFromNormalized(statsCurrent, teamId, currentSeason), { onConflict: "team_id,season" });
      statsSaved++;
    }
    if (statsPrev) {
      await supabase
        .from("quick_stats")
        .upsert(toRowFromNormalized(statsPrev, teamId, previousSeason), { onConflict: "team_id,season" });
      statsSaved++;
    }

    return { success: true, statsSaved };
  } catch (e: any) {
    return {
      success: false,
      error: e?.name === "AbortError" ? "Timeout" : e?.message || "Unknown error",
    };
  } finally {
    clearTimeout(tid);
  }
}
