/**
 * FTCScout API Client
 * Только REST API: https://ftcscout.org/api/rest
 * Базовый URL: https://api.ftcscout.org/rest/v1
 */

import { mergeNormalizedQuickStats, normalizeQuickStats, normalizeEventStats, NormalizedQuickStats, toQuickStats } from "./normalize";

export interface Team {
  number: number;
  name: string;
  region: string;
  rookieYear?: number;
  website?: string;
  city?: string;
  state?: string;
}

export interface QuickStats {
  teamNumber: number;
  season: number;
  region: string;
  OPR: number;          // OPR — для CCWM = OPR - DPR
  DPR: number | null;   // из расчёта по матчам (FTCScout events matches)
  CCWM: number | null;  // OPR - DPR
  avgAutonomous: number;
  avgTeleop: number;
  avgEndgame: number;
  matchesPlayed: number;
  winRate: number;
}

export interface Event {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  type: "qualifier" | "regional" | "championship" | "scrimmage" | "premier";
  hasMatches: boolean;
}

export interface EventSearchFilters {
  season?: number;
  type?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
}

export interface Match {
  matchNumber: string;
  eventCode: string;
  alliance: "red" | "blue";
  allianceTeams: number[];
  opponentTeams: number[];
  score: number;
  opponentScore: number;
  won: boolean;
  periodDetails?: {
    autonomous: number;
    teleop: number;
    endgame: number;
  };
}

export class FTCScoutError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "FTCScoutError";
  }
}

const REST_BASE = "https://api.ftcscout.org/rest/v1";

export class FTCScoutClient {
  private baseUrl: string;

  constructor() {
    const fromEnv = process.env.FTCSCOUT_API_URL;
    if (fromEnv?.startsWith("http")) {
      this.baseUrl = fromEnv.replace(/\/$/, "");
    } else if (fromEnv) {
      this.baseUrl = `https://${fromEnv.replace(/\/$/, "")}`;
    } else {
      this.baseUrl = REST_BASE;
    }
  }

  /**
   * GET /teams/:number — данные команды.
   * 404 если команды нет в FTCScout.
   */
  async getTeam(number: number): Promise<Team> {
    const url = `${this.baseUrl}/teams/${number}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new FTCScoutError(`Failed to fetch team ${number}`, res.status, body);
    }

    const data = await res.json();
    return data as Team;
  }

  /**
   * Определяет текущий FTC сезон (начинается в сентябре).
   */
  private getCurrentSeason(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    // До сентября — сезон прошлого года, с сентября — текущего
    return month < 8 ? year - 1 : year;
  }

  private solveLeastSquares(
    matchData: { redTeams: number[]; blueTeams: number[]; redScore: number; blueScore: number }[],
    scoreType: "alliance" | "opponent"
  ): Map<number, number> {
    const allTeams = new Set<number>();
    for (const m of matchData) {
      m.redTeams.forEach((t) => allTeams.add(t));
      m.blueTeams.forEach((t) => allTeams.add(t));
    }
    const teams = Array.from(allTeams);
    const n = teams.length;
    const teamToIdx = new Map<number, number>();
    teams.forEach((t, i) => teamToIdx.set(t, i));

    const rows: number[][] = [];
    const scores: number[] = [];
    for (const m of matchData) {
      const [r1, r2] = m.redTeams;
      const [b1, b2] = m.blueTeams;
      if (r1 == null || r2 == null || b1 == null || b2 == null) continue;
      const i1 = teamToIdx.get(r1);
      const i2 = teamToIdx.get(r2);
      const i3 = teamToIdx.get(b1);
      const i4 = teamToIdx.get(b2);
      if (i1 == null || i2 == null || i3 == null || i4 == null) continue;
      const redRow = new Array(n).fill(0);
      redRow[i1] = 1;
      redRow[i2] = 1;
      rows.push(redRow);
      scores.push(scoreType === "alliance" ? m.redScore : m.blueScore);
      const blueRow = new Array(n).fill(0);
      blueRow[i3] = 1;
      blueRow[i4] = 1;
      rows.push(blueRow);
      scores.push(scoreType === "alliance" ? m.blueScore : m.redScore);
    }

    const reg = 1e-6;
    const A: number[][] = teams.map(() => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const sVal = scores[r];
      for (let i = 0; i < n; i++) {
        if (row[i] === 0) continue;
        b[i] += sVal * row[i];
        for (let j = 0; j < n; j++) A[i][j] += row[i] * row[j];
      }
    }
    for (let i = 0; i < n; i++) A[i][i] += reg;

    const d = [...b];
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
      }
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [d[col], d[maxRow]] = [d[maxRow], d[col]];
      const pivot = A[col][col];
      if (Math.abs(pivot) < 1e-12) continue;
      for (let row = col + 1; row < n; row++) {
        const f = A[row][col] / pivot;
        d[row] -= f * d[col];
        for (let j = col; j < n; j++) A[row][j] -= f * A[col][j];
      }
    }
    for (let col = n - 1; col >= 0; col--) {
      const pivot = A[col][col];
      if (Math.abs(pivot) < 1e-12) continue;
      for (let j = col + 1; j < n; j++) d[col] -= A[col][j] * d[j];
      d[col] /= pivot;
    }

    const out = new Map<number, number>();
    teams.forEach((t, i) => out.set(t, d[i]));
    return out;
  }

  private computeOprMatrix(matchData: { redTeams: number[]; blueTeams: number[]; redScore: number; blueScore: number }[]): Map<number, number> {
    return this.solveLeastSquares(matchData, "alliance");
  }

  private computeDprMatrix(matchData: { redTeams: number[]; blueTeams: number[]; redScore: number; blueScore: number }[]): Map<number, number> {
    return this.solveLeastSquares(matchData, "opponent");
  }

  /**
   * Статистика команды. Как Bonfire: сначала статы последнего события.
   * Fallback: глобальные quick-stats + DPR из матчей.
   */
  async getTeamQuickStats(
    number: number,
    season?: number,
    region?: string
  ): Promise<QuickStats> {
    const s = season ?? this.getCurrentSeason();
    const fetchOpts: RequestInit = { headers: { Accept: "application/json" }, cache: "no-store" };

    // 1) Stats for period: all qual matches from all events in the season
    try {
      const participations = await this.getTeamEventParticipations(number, s);
      if (Array.isArray(participations) && participations.length > 0) {
        const allMatchData: { redTeams: number[]; blueTeams: number[]; redScore: number; blueScore: number; redEg?: number; blueEg?: number }[] = [];
        const eventStatsForAvg: NormalizedQuickStats[] = [];

        for (const p of participations) {
          const rec = p as Record<string, unknown>;
          const code = (rec.eventCode as string) || (rec.event != null && typeof rec.event === "object" ? (rec.event as Record<string, unknown>).code as string : "");
          if (!code) continue;
          const eventMatches = await this.getEventMatches(s, code) as Array<Record<string, unknown>>;
          for (const em of eventMatches || []) {
            const level = (em.tournamentLevel as string) || "";
            if (level !== "Quals" && level !== "quals" && level.toLowerCase() !== "qualification") continue;
            const scores = em.scores as {
              red?: {
                totalPoints?: number; autoPoints?: number; dcPoints?: number;
                egPoints?: number; endgamePoints?: number; eg?: number; endgame?: number; endGame?: number;
                breakdown?: { endgame?: number; eg?: number }; periods?: { endgame?: number };
              };
              blue?: {
                totalPoints?: number; autoPoints?: number; dcPoints?: number;
                egPoints?: number; endgamePoints?: number; eg?: number; endgame?: number; endGame?: number;
                breakdown?: { endgame?: number; eg?: number }; periods?: { endgame?: number };
              };
            } | undefined;
            const teams = em.teams as Array<{ alliance?: string; teamNumber?: number; noShow?: boolean; surrogate?: boolean }> | undefined;
            if (!scores || !teams?.length) continue;
            const redTeams = teams.filter((t) => (t.alliance || "").toLowerCase() === "red" && !t.noShow && !t.surrogate).map((t) => t.teamNumber!).filter(Boolean);
            const blueTeams = teams.filter((t) => (t.alliance || "").toLowerCase() === "blue" && !t.noShow && !t.surrogate).map((t) => t.teamNumber!).filter(Boolean);
            const redScore = scores.red?.totalPoints ?? 0;
            const blueScore = scores.blue?.totalPoints ?? 0;
            const redEg = scores.red?.egPoints ?? scores.red?.endgamePoints ?? scores.red?.eg ?? scores.red?.endgame ?? scores.red?.endGame
              ?? scores.red?.breakdown?.endgame ?? scores.red?.breakdown?.eg ?? scores.red?.periods?.endgame;
            const blueEg = scores.blue?.egPoints ?? scores.blue?.endgamePoints ?? scores.blue?.eg ?? scores.blue?.endgame ?? scores.blue?.endGame
              ?? scores.blue?.breakdown?.endgame ?? scores.blue?.breakdown?.eg ?? scores.blue?.periods?.endgame;
            if (redTeams.length >= 2 && blueTeams.length >= 2) {
              allMatchData.push({
                redTeams: redTeams.slice(0, 2),
                blueTeams: blueTeams.slice(0, 2),
                redScore,
                blueScore,
                redEg,
                blueEg,
              });
            }
          }
          const lastStats = rec.stats ?? rec.Stats ?? rec.eventStats;
          if (lastStats != null && typeof lastStats === "object") {
            const evNorm = normalizeEventStats(lastStats, number, s);
            if (evNorm) eventStatsForAvg.push(evNorm);
          }
        }

        if (allMatchData.length === 0) {
          const merged = mergeNormalizedQuickStats(eventStatsForAvg);
          if (merged) return toQuickStats(merged) as QuickStats;
          throw new FTCScoutError(`No qual matches for team ${number} in season ${s}`, 404);
        }

        const dprMap = this.computeDprMatrix(allMatchData);
        const oprMap = this.computeOprMatrix(allMatchData);
        const opr = oprMap.get(number) ?? null;
        const dpr = dprMap.get(number) ?? null;

        let wins = 0, losses = 0, ties = 0;
        for (const m of allMatchData) {
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

        let sumEndgame = 0;
        let endgameCount = 0;
        for (const m of allMatchData) {
          const redIncludes = m.redTeams.includes(number);
          const blueIncludes = m.blueTeams.includes(number);
          if (!redIncludes && !blueIncludes) continue;
          const eg = redIncludes ? m.redEg : m.blueEg;
          if (typeof eg === "number" && !Number.isNaN(eg)) {
            sumEndgame += eg;
            endgameCount++;
          }
        }
        const avgEndgame = endgameCount > 0 ? sumEndgame / endgameCount : null;

        const merged = mergeNormalizedQuickStats(eventStatsForAvg);
        const base = merged ?? {
          teamNumber: number,
          season: s,
          region: "",
          OPR: null,
          DPR: null,
          CCWM: null,
          avgAutonomous: null,
          avgTeleop: null,
          avgEndgame: null,
          matchesPlayed: 0,
          winRate: null,
        };

        // Match Bonfire: use FTCScout global quick-stats (tot, auto, dc, eg) for OPR and avg Auto/Teleop/Endgame.
        let bonfireOPR: number | null = null;
        let bonfireAuto: number | null = null;
        let bonfireDc: number | null = null;
        let bonfireEg: number | null = avgEndgame ?? base.avgEndgame ?? null;
        try {
          const qsRes = await fetch(`${this.baseUrl}/teams/${number}/quick-stats?season=${s}`, fetchOpts);
          if (qsRes.ok) {
            const qsData = await qsRes.json().catch(() => null);
            if (qsData != null && typeof qsData === "object") {
              const obj = qsData as Record<string, unknown>;
              const pick = (key: string): number | null => {
                const v = obj[key];
                if (v != null && typeof v === "object" && "value" in v) {
                  const x = (v as Record<string, unknown>).value;
                  if (typeof x === "number" && !Number.isNaN(x)) return x;
                  if (typeof x === "string") { const n = parseFloat(x); return Number.isNaN(n) ? null : n; }
                }
                if (typeof v === "number" && !Number.isNaN(v)) return v;
                return null;
              };
              bonfireOPR = pick("tot") ?? pick("opr");
              bonfireAuto = pick("auto");
              bonfireDc = pick("dc");
              bonfireEg = pick("eg") ?? bonfireEg;
            }
          }
        } catch { /* ignore */ }

        const norm: NormalizedQuickStats = {
          ...base,
          OPR: bonfireOPR ?? opr ?? base.OPR,
          DPR: dpr ?? base.DPR,
          CCWM: (() => {
            const o = bonfireOPR ?? opr ?? base.OPR;
            const d = dpr ?? base.DPR;
            if (o != null && d != null && !Number.isNaN(d)) return o - d;
            if (base.OPR != null && base.DPR != null) return base.OPR - base.DPR;
            return null;
          })(),
          avgAutonomous: bonfireAuto ?? base.avgAutonomous,
          avgTeleop: bonfireDc ?? base.avgTeleop,
          avgEndgame: bonfireEg ?? base.avgEndgame,
          matchesPlayed,
          winRate,
        };
        return toQuickStats(norm) as QuickStats;
      }
    } catch {
      /* fall through to global quick-stats */
    }

    // 2) Fallback: REST quick-stats + DPR from all events
    const params = new URLSearchParams();
    if (season != null) params.set("season", String(season));
    if (region) params.set("region", region);
    const qs = params.toString();
    const res = await fetch(`${this.baseUrl}/teams/${number}/quick-stats${qs ? `?${qs}` : ""}`, fetchOpts);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      let norm = normalizeQuickStats(data, number, s);
      if (norm) {
        if (norm.DPR == null && norm.OPR != null) {
          try {
            const participations = await this.getTeamMatches(number, s) as Array<{ eventCode?: string }>;
            const eventCodes = [...new Set(participations.map((p: any) => p.eventCode).filter(Boolean))] as string[];
            let bestDpr: number | null = null;
            for (const code of eventCodes) {
              const eventMatches = await this.getEventMatches(s, code) as Array<Record<string, unknown>>;
              const matchData: { redTeams: number[]; blueTeams: number[]; redScore: number; blueScore: number }[] = [];
              for (const em of eventMatches || []) {
                const level = (em.tournamentLevel as string) || "";
                if (level !== "Quals" && level !== "quals" && level.toLowerCase() !== "qualification") continue;
                const scores = em.scores as { red?: { totalPoints?: number }; blue?: { totalPoints?: number } } | undefined;
                const teams = em.teams as Array<{ alliance?: string; teamNumber?: number; noShow?: boolean; surrogate?: boolean }> | undefined;
                if (!scores || !teams?.length) continue;
                const redTeams = teams.filter((t) => (t.alliance || "").toLowerCase() === "red" && !t.noShow && !t.surrogate).map((t) => t.teamNumber!).filter(Boolean);
                const blueTeams = teams.filter((t) => (t.alliance || "").toLowerCase() === "blue" && !t.noShow && !t.surrogate).map((t) => t.teamNumber!).filter(Boolean);
                const redScore = scores.red?.totalPoints ?? 0;
                const blueScore = scores.blue?.totalPoints ?? 0;
                if (redTeams.length >= 2 && blueTeams.length >= 2) {
                  matchData.push({ redTeams: redTeams.slice(0, 2), blueTeams: blueTeams.slice(0, 2), redScore, blueScore });
                }
              }
              if (matchData.length > 0) {
                const dprMap = this.computeDprMatrix(matchData);
                const dpr = dprMap.get(number);
                if (dpr != null && !Number.isNaN(dpr)) {
                  if (bestDpr == null || dpr < bestDpr) bestDpr = dpr;
                }
              }
            }
            if (bestDpr != null) norm = { ...norm, DPR: bestDpr, CCWM: norm.OPR! - bestDpr };
          } catch { /* no DPR */ }
        }
        if (norm.matchesPlayed === 0 || norm.winRate == null) {
          try {
            const list = await this.getTeamEventParticipations(number, s);
            if (Array.isArray(list) && list.length > 0) {
              const norms: NormalizedQuickStats[] = [];
              for (const p of list) {
                const rec = p as Record<string, unknown>;
                const st = rec?.stats ?? rec?.Stats ?? rec?.eventStats;
                if (st != null && typeof st === "object") {
                  const n = normalizeEventStats(st, number, s);
                  if (n) norms.push(n);
                }
              }
              const merged = mergeNormalizedQuickStats(norms);
              if (merged) {
                if (norm.matchesPlayed === 0 && merged.matchesPlayed > 0) norm = { ...norm, matchesPlayed: merged.matchesPlayed };
                if (norm.winRate == null && merged.winRate != null) norm = { ...norm, winRate: merged.winRate };
                if (norm.DPR == null && merged.DPR != null) norm = { ...norm, DPR: merged.DPR };
                if (norm.CCWM == null && merged.CCWM != null) norm = { ...norm, CCWM: merged.CCWM };
              }
            }
          } catch { /* keep norm */ }
        }
        return toQuickStats(norm) as QuickStats;
      }
    } else if (res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      throw new FTCScoutError(`Failed to fetch quick stats for team ${number}`, res.status, body);
    }

    try {
      const list = await this.getTeamEventParticipations(number, s);
      if (Array.isArray(list) && list.length > 0) {
        const norms: NormalizedQuickStats[] = [];
        for (const p of list) {
          const rec = p as Record<string, unknown>;
          const st = rec?.stats ?? rec?.Stats ?? rec?.eventStats;
          if (st != null && typeof st === "object") {
            const n = normalizeEventStats(st, number, s);
            if (n) norms.push(n);
          }
        }
        const merged = mergeNormalizedQuickStats(norms);
        if (merged) return toQuickStats(merged) as QuickStats;
      }
    } catch { /* ignore */ }

    throw new FTCScoutError(`Quick stats not found for team ${number} (season ${s}). Team may have no events in this season.`, 404, {});
  }

  /**
   * GET /teams/:number/events/:season — участия в событиях; у каждого есть stats.
   */
  async getTeamEventParticipations(number: number, season?: number): Promise<unknown[]> {
    const s = season ?? this.getCurrentSeason();
    const r = await fetch(`${this.baseUrl}/teams/${number}/events/${s}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const raw = await r.json().catch(() => null);
    if (Array.isArray(raw)) return raw;
    if (raw != null && typeof raw === "object") {
      const arr = (raw as Record<string, unknown>).data ?? (raw as Record<string, unknown>).participations ?? (raw as Record<string, unknown>).eventParticipations;
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  }

  async getTeamEvents(number: number, season?: number): Promise<Event[]> {
    const s = season ?? new Date().getFullYear();
    const res = await fetch(`${this.baseUrl}/teams/${number}/events/${s}`);
    if (!res.ok) throw new FTCScoutError(`Failed to fetch events for team ${number}`, res.status, await res.json().catch(() => null));
    return res.json();
  }

  async getTeamMatches(number: number, season?: number, eventCode?: string): Promise<Match[]> {
    const params = new URLSearchParams();
    if (season != null) params.set("season", String(season));
    if (eventCode) params.set("eventCode", eventCode);
    const qs = params.toString();
    const res = await fetch(`${this.baseUrl}/teams/${number}/matches${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new FTCScoutError(`Failed to fetch matches for team ${number}`, res.status, await res.json().catch(() => null));
    return res.json();
  }

  async searchEvents(filters: EventSearchFilters): Promise<Event[]> {
    const params = new URLSearchParams();
    if (filters.season != null) params.set("season", String(filters.season));
    if (filters.type) params.set("type", filters.type);
    if (filters.region) params.set("region", filters.region);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    const qs = params.toString();
    const res = await fetch(`${this.baseUrl}/events/search${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new FTCScoutError("Failed to search events", res.status, await res.json().catch(() => null));
    return res.json();
  }

  async getEventTeams(season: number, code: string) {
    const res = await fetch(`${this.baseUrl}/events/${season}/${code}/teams`);
    if (!res.ok) throw new FTCScoutError(`Failed to fetch teams for event ${code}`, res.status, await res.json().catch(() => null));
    return res.json();
  }

  async getEventMatches(season: number, code: string): Promise<Match[]> {
    const res = await fetch(`${this.baseUrl}/events/${season}/${code}/matches`);
    if (!res.ok) throw new FTCScoutError(`Failed to fetch matches for event ${code}`, res.status, await res.json().catch(() => null));
    return res.json();
  }

  /** GET /events/:season/:code — детали события (start, end). */
  async getEventDetails(season: number, code: string): Promise<{ start?: string; end?: string } | null> {
    const res = await fetch(`${this.baseUrl}/events/${season}/${code}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data == null || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    return {
      start: typeof o.start === "string" ? o.start : typeof o.startDate === "string" ? o.startDate : undefined,
      end: typeof o.end === "string" ? o.end : typeof o.endDate === "string" ? o.endDate : undefined,
    };
  }
}

export const ftcscoutClient = new FTCScoutClient();
