/**
 * FIRST FTC Events API Client
 * Base URL: https://ftc-api.firstinspires.org
 * Docs: https://ftc-events.firstinspires.org/api-docs
 * Auth: Basic base64(username:token)
 */

const FIRST_API_BASE = "https://ftc-api.firstinspires.org";

export interface FirstTeam {
  teamNumber: number;
  nameFull: string | null;
  nameShort: string | null;
  schoolName: string | null;
  city: string | null;
  stateProv: string | null;
  country: string | null;
  website: string | null;
  rookieYear: number | null;
}

export interface FirstEvent {
  code: string;
  name: string | null;
  dateStart: string;
  dateEnd: string;
  type: string | null;
  typeName: string | null;
  venue: string | null;
  city: string | null;
  stateprov: string | null;
  country: string | null;
}

export interface FirstMatchResult {
  matchNumber: number;
  series: number;
  tournamentLevel: string | null;
  scoreRedFinal: number;
  scoreBlueFinal: number;
  scoreRedFoul?: number;
  scoreBlueFoul?: number;
  scoreRedAuto?: number;
  scoreBlueAuto?: number;
  teams?: Array<{
    teamNumber: number;
    station: string | null;
    dq?: boolean;
    onField?: boolean;
  }>;
}

function getAuthHeader(): string | null {
  const user = process.env.FIRST_FTC_API_USERNAME ?? process.env.FIRST_API_USERNAME;
  const token = process.env.FIRST_FTC_API_TOKEN ?? process.env.FIRST_API_TOKEN;
  if (!user || !token) return null;
  try {
    const encoded = Buffer.from(`${user}:${token}`, "utf8").toString("base64");
    return `Basic ${encoded}`;
  } catch {
    return null;
  }
}

function isConfigured(): boolean {
  return !!(process.env.FIRST_FTC_API_USERNAME ?? process.env.FIRST_API_USERNAME) &&
    !!(process.env.FIRST_FTC_API_TOKEN ?? process.env.FIRST_API_TOKEN);
}

export class FirstApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "FirstApiError";
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const auth = getAuthHeader();
  if (!auth) throw new FirstApiError("FIRST API not configured (missing username/token)", 401);

  const url = path.startsWith("http") ? path : `${FIRST_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: auth },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new FirstApiError(`FIRST API error: ${res.status}`, res.status, body);
  }

  return res.json() as Promise<T>;
}

function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month < 8 ? year - 1 : year;
}

/**
 * Returns true if FIRST API credentials are set.
 */
export function firstApiConfigured(): boolean {
  return isConfigured();
}

/**
 * GET /v2.0/{season}/teams?teamNumber={number}
 */
export async function getTeam(season: number, teamNumber: number): Promise<FirstTeam | null> {
  const raw = await fetchJson<{ teams: FirstTeam[] }>(
    `/v2.0/${season}/teams?teamNumber=${teamNumber}`
  );
  const teams = raw?.teams;
  return Array.isArray(teams) && teams.length > 0 ? teams[0] : null;
}

/**
 * GET /v2.0/{season}/events?teamNumber={number}
 */
export async function getTeamEvents(season: number, teamNumber: number): Promise<FirstEvent[]> {
  const raw = await fetchJson<{ events: FirstEvent[] }>(
    `/v2.0/${season}/events?teamNumber=${teamNumber}`
  );
  const events = raw?.events;
  return Array.isArray(events) ? events : [];
}

/**
 * GET /v2.0/{season}/matches/{eventCode}?tournamentLevel=qual
 * Returns match results (including scores) for qualification matches.
 */
export async function getEventMatches(
  season: number,
  eventCode: string,
  opts?: { teamNumber?: number }
): Promise<FirstMatchResult[]> {
  let path = `/v2.0/${season}/matches/${encodeURIComponent(eventCode)}?tournamentLevel=qual`;
  if (opts?.teamNumber) path += `&teamNumber=${opts.teamNumber}`;
  const raw = await fetchJson<{ matches: FirstMatchResult[] }>(path);
  const matches = raw?.matches;
  return Array.isArray(matches) ? matches : [];
}

export interface MatchRow {
  redTeams: [number, number];
  blueTeams: [number, number];
  redScore: number;
  blueScore: number;
}

import { computeOprMatrix, computeDprMatrix } from "@/lib/opr-dpr";

/** QuickStats shape compatible with FTCScout client. */
export interface QuickStats {
  teamNumber: number;
  season: number;
  region: string;
  OPR: number;
  DPR: number | null;
  CCWM: number | null;
  avgAutonomous: number;
  avgTeleop: number;
  avgEndgame: number;
  matchesPlayed: number;
  winRate: number;
}

/**
 * Get team quick stats from FIRST API (qual matches from all events in season).
 * Returns same shape as FTCScout getTeamQuickStats.
 * OPR/DPR and match count are computed from all qual matches across all events.
 */
export async function getTeamQuickStatsFromFirst(
  number: number,
  season?: number
): Promise<QuickStats> {
  const s = season ?? getCurrentSeason();
  const events = await getTeamEvents(s, number);
  if (events.length === 0) throw new FirstApiError(`No events for team ${number} in season ${s}`, 404);

  const allRows: MatchRow[] = [];
  for (const ev of events) {
    const matches = await getEventMatches(s, ev.code);
    const rows = firstMatchesToRows(matches);
    allRows.push(...rows);
  }

  if (allRows.length === 0) throw new FirstApiError(`No qual match data for team ${number} in season ${s}`, 404);

  const oprMap = computeOprMatrix(allRows);
  const dprMap = computeDprMatrix(allRows);
  const opr = oprMap.get(number);
  const dpr = dprMap.get(number);
  if (opr == null || Number.isNaN(opr)) throw new FirstApiError(`No OPR for team ${number} in season ${s}`, 404);

  let wins = 0, losses = 0, ties = 0;
  for (const m of allRows) {
    const redIncludes = m.redTeams.includes(number);
    const blueIncludes = m.blueTeams.includes(number);
    if (!redIncludes && !blueIncludes) continue;
    const redWon = m.redScore > m.blueScore;
    const blueWon = m.blueScore > m.redScore;
    const isTie = m.redScore === m.blueScore;
    if (isTie) ties++;
    else if (redIncludes && redWon) wins++;
    else if (redIncludes && blueWon) losses++;
    else if (blueIncludes && blueWon) wins++;
    else if (blueIncludes && redWon) losses++;
  }
  const matchesPlayed = wins + losses + ties;
  const winRate = matchesPlayed > 0 ? wins / matchesPlayed : 0;
  const ccwm = dpr != null && !Number.isNaN(dpr) ? opr - dpr : null;

  const team = await getTeam(s, number);
  const region = team?.stateProv ?? team?.country ?? "";

  return {
    teamNumber: number,
    season: s,
    region: typeof region === "string" ? region : "",
    OPR: opr,
    DPR: dpr ?? null,
    CCWM: ccwm,
    avgAutonomous: 0,
    avgTeleop: 0,
    avgEndgame: 0,
    matchesPlayed,
    winRate,
  };
}

/**
 * Parse FIRST match results into rows for OPR/DPR.
 * Uses station (Red1, Red2, Blue1, Blue2) to assign teams.
 */
export function firstMatchesToRows(matches: FirstMatchResult[]): MatchRow[] {
  const rows: MatchRow[] = [];
  for (const m of matches) {
    const teams = m.teams ?? [];
    if (teams.length < 4) continue;

    const red = teams.filter((t) => (t.station ?? "").toLowerCase().startsWith("red")).map((t) => t.teamNumber);
    const blue = teams.filter((t) => (t.station ?? "").toLowerCase().startsWith("blue")).map((t) => t.teamNumber);

    const redOnField = teams.filter((t) => t.onField !== false && !t.dq && (t.station ?? "").toLowerCase().startsWith("red")).map((t) => t.teamNumber);
    const blueOnField = teams.filter((t) => t.onField !== false && !t.dq && (t.station ?? "").toLowerCase().startsWith("blue")).map((t) => t.teamNumber);

    const redTeams = (redOnField.length >= 2 ? redOnField : red).slice(0, 2) as [number, number];
    const blueTeams = (blueOnField.length >= 2 ? blueOnField : blue).slice(0, 2) as [number, number];

    if (redTeams.length < 2 || blueTeams.length < 2) continue;

    const redScore = m.scoreRedFinal ?? 0;
    const blueScore = m.scoreBlueFinal ?? 0;

    rows.push({
      redTeams: [redTeams[0], redTeams[1]],
      blueTeams: [blueTeams[0], blueTeams[1]],
      redScore,
      blueScore,
    });
  }
  return rows;
}
