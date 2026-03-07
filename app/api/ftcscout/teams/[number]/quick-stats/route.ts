import { NextRequest, NextResponse } from "next/server";
import { ftcscoutClient } from "@/lib/ftcscout/client";
import { normalizeQuickStats, normalizeEventStats } from "@/lib/ftcscout/normalize";
import { firstApiConfigured, getTeamQuickStatsFromFirst } from "@/lib/first-api/client";

const REST_BASE = (process.env.FTCSCOUT_API_URL || "https://api.ftcscout.org/rest/v1").replace(/\/$/, "");
const GRAPHQL_URL = (() => {
  try {
    return new URL(REST_BASE).origin + "/graphql";
  } catch {
    return "https://api.ftcscout.org/graphql";
  }
})();

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
    const seasonParam = searchParams.get("season");
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined;
    // FTC сезон начинается в сентябре
    const now = new Date();
    const defaultSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const seasonNum = season ?? defaultSeason;
    const region = searchParams.get("region") || undefined;
    const debug = searchParams.get("debug") === "1";

    if (debug) {
      const opts: RequestInit = { headers: { Accept: "application/json" }, cache: "no-store" };
      const restUrl = `${REST_BASE}/teams/${teamNumber}/quick-stats?season=${seasonNum}`;
      const restRes = await fetch(restUrl, opts);
      let restBody: unknown = null;
      const restText = await restRes.text();
      try {
        restBody = restText ? JSON.parse(restText) : null;
      } catch {
        restBody = { _rawPreview: restText.slice(0, 800) };
      }

      const gqlRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query ($n: Int!, $s: Int) { team(number: $n) { number quickStats(season: $s) { OPR avgAutonomous avgTeleop avgEndgame matchesPlayed winRate } } }`,
          variables: { n: teamNumber, s: seasonNum },
        }),
        cache: "no-store",
      });
      const gqlBody = await gqlRes.json().catch(() => null);

      const eventsUrl = `${REST_BASE}/teams/${teamNumber}/events/${seasonNum}`;
      const eventsRes = await fetch(eventsUrl, opts);
      let eventsBody: unknown = null;
      const eventsText = await eventsRes.text();
      try {
        eventsBody = eventsText ? JSON.parse(eventsText) : null;
      } catch {
        eventsBody = { _rawPreview: eventsText.slice(0, 800) };
      }

      const eventsArr = Array.isArray(eventsBody)
        ? eventsBody
        : (eventsBody as Record<string, unknown>)?.data ?? (eventsBody as Record<string, unknown>)?.participations;
      const firstPart = Array.isArray(eventsArr) && eventsArr.length > 0 ? eventsArr[0] : null;
      const firstStats = firstPart && typeof firstPart === "object" ? (firstPart as Record<string, unknown>).stats ?? (firstPart as Record<string, unknown>).Stats : null;

      const normFromRest = restRes.ok && restBody && typeof restBody === "object" ? normalizeQuickStats(restBody, teamNumber, seasonNum) : null;
      const normFromEvents = firstStats ? normalizeEventStats(firstStats, teamNumber, seasonNum) : null;

      return NextResponse.json({
        debug: true,
        teamNumber,
        season: seasonNum,
        rest: { status: restRes.status, ok: restRes.ok, url: restUrl, body: restBody },
        graphql: { data: gqlBody?.data, errors: gqlBody?.errors, body: gqlBody },
        events: { status: eventsRes.status, ok: eventsRes.ok, url: eventsUrl, isArray: Array.isArray(eventsBody), count: Array.isArray(eventsArr) ? eventsArr.length : 0, firstParticipation: firstPart, firstStats },
        parseAttempts: { fromRest: normFromRest ? "ok" : "fail", fromEvents: normFromEvents ? "ok" : "fail" },
        parsed: { fromRest: normFromRest, fromEvents: normFromEvents },
        hint: "fromRest берёт tot.value/auto.value/dc.value/eg.value; fromEvents берёт avg.autoPoints, wins/losses, qualMatchesPlayed и т.п.",
      });
    }

    let stats;
    if (firstApiConfigured()) {
      try {
        stats = await getTeamQuickStatsFromFirst(teamNumber, seasonNum);
      } catch (e) {
        const is404 = (e as { statusCode?: number })?.statusCode === 404;
        if (is404) throw e;
        console.warn("FIRST API quick-stats failed, falling back to FTCScout:", e);
        stats = await ftcscoutClient.getTeamQuickStats(teamNumber, season, region);
      }
    } else {
      stats = await ftcscoutClient.getTeamQuickStats(teamNumber, season, region);
    }
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    const code = err?.statusCode;
    if (code !== 404) {
      console.error("Error fetching quick stats:", error);
    }
    const status = typeof code === "number" && code >= 400 && code < 600 ? code : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to fetch quick stats" },
      { status }
    );
  }
}




