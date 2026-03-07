import { NextRequest, NextResponse } from "next/server";

const REST_BASE = (process.env.FTCSCOUT_API_URL || "https://api.ftcscout.org/rest/v1").replace(/\/$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: { season: string; code: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(params.season);
    const code = params.code;
    const debug = searchParams.get("debug") === "1";

    if (isNaN(season)) {
      return NextResponse.json({ error: "Invalid season" }, { status: 400 });
    }

    // FTCScout: GET /events/{season}/{eventCode}/teams
    const url = `${REST_BASE}/events/${season}/${code}/teams`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });

    if (debug) {
      const rawText = await res.text();
      let body: unknown = rawText;
      try { body = JSON.parse(rawText); } catch {}
      return NextResponse.json({
        debug: true,
        url,
        status: res.status,
        ok: res.ok,
        isArray: Array.isArray(body),
        count: Array.isArray(body) ? body.length : null,
        firstTeam: Array.isArray(body) && body.length > 0 ? body[0] : null,
        body,
      });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `FTCScout returned ${res.status}`, teams: [] }, { status: res.status });
    }

    const raw = await res.json().catch(() => null);

    // Разворачиваем обёртки
    let arr: unknown[] = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (raw && typeof raw === "object") {
      const maybeArr = (raw as Record<string, unknown>).data ?? (raw as Record<string, unknown>).teams;
      if (Array.isArray(maybeArr)) arr = maybeArr;
    }

    // FTCScout возвращает TeamEventParticipation: { teamNumber, eventCode, season, stats, ... }
    const teams = arr.map((t: unknown) => {
      const o = t as Record<string, unknown>;
      const stats = o.stats as Record<string, unknown> | null;
      return {
        teamNumber: o.teamNumber ?? o.number ?? 0,
        eventCode: o.eventCode ?? code,
        season: o.season ?? season,
        // Из stats достаём ключевые поля
        rank: stats?.rank ?? null,
        wins: stats?.wins ?? null,
        losses: stats?.losses ?? null,
        qualMatchesPlayed: stats?.qualMatchesPlayed ?? null,
        // OPR из stats.opr.totalPointsNp
        opr: (stats?.opr as Record<string, unknown>)?.totalPointsNp ?? null,
      };
    });

    return NextResponse.json(teams);
  } catch (error: unknown) {
    console.error("Error fetching event teams:", error);
    const msg = error instanceof Error ? error.message : "Failed to fetch event teams";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}




