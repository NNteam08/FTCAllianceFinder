/**
 * Нормализация ответа FTCScout REST API.
 *
 * REST /teams/:number/quick-stats возвращает:
 *   { tot: { value, rank }, auto: { value, rank }, dc: { value, rank }, eg: { value, rank }, count, season, number }
 *
 * REST /teams/:number/events/:season возвращает массив participation с полем stats:
 *   stats: { qualMatchesPlayed, wins, losses, ties, avg: { autoPoints, dcPoints, ... }, opr: { totalPointsNp, ... }, ... }
 */

export interface NormalizedQuickStats {
  teamNumber: number;
  season: number;
  region: string;
  OPR: number | null;           // OPR — для CCWM
  DPR: number | null;           // Defensive Power Rating — очки, пропущенные командой
  CCWM: number | null;          // Contribution to Ceiling Win Margin = OPR - DPR
  avgAutonomous: number | null; // auto.value или avg.autoPoints
  avgTeleop: number | null;     // dc.value или avg.dcPoints
  avgEndgame: number | null;    // eg.value
  matchesPlayed: number;        // qualMatchesPlayed
  winRate: number | null;       // wins / (wins + losses + ties)
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Достаёт число по ключу (или вложенному ключу через ".") */
function pickNum(obj: unknown, ...paths: string[]): number | null {
  if (obj == null || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const p of paths) {
    if (p.includes(".")) {
      const [first, ...rest] = p.split(".");
      const nested = o[first];
      if (nested != null && typeof nested === "object") {
        const n = pickNum(nested, rest.join("."));
        if (n != null) return n;
      }
    } else {
      const n = toNum(o[p]);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Нормализует ответ REST /teams/:n/quick-stats
 * Формат: { tot: { value }, auto: { value }, dc: { value }, eg: { value }, count, season, number }
 */
export function normalizeQuickStats(
  raw: unknown,
  teamNumber?: number,
  season?: number
): NormalizedQuickStats | null {
  if (raw == null || typeof raw !== "object") return null;
  const rawObj = raw as Record<string, unknown>;
  // REST может отдать как { tot, auto, ... } или как { data: { tot, auto, ... } }
  const o = (rawObj.data != null && typeof rawObj.data === "object")
    ? (rawObj.data as Record<string, unknown>)
    : rawObj;

  const tn = pickNum(o, "number", "teamNumber") ?? teamNumber ?? 0;
  // FTC сезон: до сентября — прошлый год, с сентября — текущий
  const now = new Date();
  const defaultSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
  const seg = pickNum(o, "season") ?? season ?? defaultSeason;
  const reg = typeof o.region === "string" ? o.region : "";

  // FTCScout quick-stats: tot.value, auto.value, dc.value, eg.value
  const OPR = pickNum(o, "opr.totalPoints", "tot.value", "OPR", "opr");
  const DPR = pickNum(o, "dpr.value", "dpr", "DPR", "opr.dpr", "tot.dpr", "defensivePowerRating");
  let CCWM = pickNum(o, "ccwm.value", "ccwm", "CCWM", "opr.ccwm", "tot.ccwm", "contributionToWinningMargin");
  if (CCWM == null && OPR != null && DPR != null) CCWM = OPR - DPR;

  const avgAutonomous = pickNum(o, "auto.value", "avgAutonomous", "avg.autoPoints", "opr.autoPoints");
  const avgTeleop = pickNum(o, "dc.value", "avgTeleop", "avg.dcPoints", "opr.dcPoints");
  const avgEndgame = pickNum(o, "eg.value", "avgEndgame", "avg.egPoints", "avg.endgamePoints", "opr.egPoints", "endgamePoints");

  // matchesPlayed: qualMatchesPlayed/matchesPlayed в приоритете. "count" часто — размер выборки (тысячи), используем только если нет других и значение разумное (≤ 200 матчей за сезон)
  const explicitMatches = pickNum(o, "qualMatchesPlayed", "matchesPlayed", "matches_played");
  const countVal = pickNum(o, "count");
  const matchesPlayed = Math.max(0, Math.floor(Number(
    explicitMatches ?? (countVal != null && countVal <= 200 ? countVal : null)
  ) || 0));

  // winRate: wins / (wins + losses + ties) или прямо из API (winRate)
  const wins = pickNum(o, "wins");
  const losses = pickNum(o, "losses");
  const ties = pickNum(o, "ties");
  let winRate: number | null = pickNum(o, "winRate", "win_rate");
  if (winRate == null && wins != null && losses != null) {
    const total = wins + losses + (ties ?? 0);
    winRate = total > 0 ? wins / total : null;
  }

  const hasAny = OPR != null || avgAutonomous != null || avgTeleop != null || avgEndgame != null || matchesPlayed > 0 || winRate != null || DPR != null || CCWM != null;
  if (!hasAny) return null;

  return { teamNumber: tn, season: seg, region: reg, OPR, DPR, CCWM, avgAutonomous, avgTeleop, avgEndgame, matchesPlayed, winRate };
}

/**
 * Нормализует stats из TeamEventParticipation (events/:season ответ).
 * Формат: { qualMatchesPlayed, wins, losses, ties, avg: { autoPoints, dcPoints }, opr: { totalPointsNp }, ... }
 */
export function normalizeEventStats(
  stats: unknown,
  teamNumber?: number,
  season?: number
): NormalizedQuickStats | null {
  if (stats == null || typeof stats !== "object") return null;
  const o = stats as Record<string, unknown>;

  const tn = teamNumber ?? 0;
  const now = new Date();
  const defaultSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
  const seg = season ?? defaultSeason;

  const OPR = pickNum(o, "opr.totalPoints", "tot.value");
  const DPR = pickNum(o, "opr.dpr", "dpr", "DPR", "dpr.value", "tot.dpr");
  let CCWM = pickNum(o, "opr.ccwm", "ccwm", "CCWM", "ccwm.value", "tot.ccwm");
  if (CCWM == null && OPR != null && DPR != null) CCWM = OPR - DPR;

  const avgAutonomous = pickNum(o, "avg.autoPoints", "opr.autoPoints", "auto.value");
  const avgTeleop = pickNum(o, "avg.dcPoints", "opr.dcPoints", "dc.value");
  const avgEndgame = pickNum(o, "avg.egPoints", "avg.endgamePoints", "eg.value", "opr.egPoints", "endgamePoints");

  const matchesPlayed = Math.max(0, Math.floor(Number(pickNum(o, "qualMatchesPlayed", "matchesPlayed", "matches_played")) || 0));

  const wins = pickNum(o, "wins");
  const losses = pickNum(o, "losses");
  const ties = pickNum(o, "ties");
  let winRate: number | null = null;
  if (wins != null && losses != null) {
    const total = wins + losses + (ties ?? 0);
    winRate = total > 0 ? wins / total : null;
  }

  const hasAny = OPR != null || avgAutonomous != null || avgTeleop != null || avgEndgame != null || matchesPlayed > 0 || winRate != null || DPR != null || CCWM != null;
  if (!hasAny) return null;

  return { teamNumber: tn, season: seg, region: "", OPR, DPR, CCWM, avgAutonomous, avgTeleop, avgEndgame, matchesPlayed, winRate };
}

/** Агрегирует несколько NormalizedQuickStats (напр. из events): средние по числам, сумма matchesPlayed. */
export function mergeNormalizedQuickStats(arr: NormalizedQuickStats[]): NormalizedQuickStats | null {
  if (arr.length === 0) return null;
  const n = (k: keyof NormalizedQuickStats): number | null => {
    const vals = arr.map((a) => a[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const OPR = n("OPR");
  const avgAutonomous = n("avgAutonomous");
  const avgTeleop = n("avgTeleop");
  const avgEndgame = n("avgEndgame");
  const winRate = n("winRate");
  const DPR = n("DPR");
  let CCWM = n("CCWM");
  if (CCWM == null && OPR != null && DPR != null) CCWM = OPR - DPR;
  const matchesPlayed = arr.reduce((s, a) => s + a.matchesPlayed, 0);
  const hasAny = OPR != null || avgAutonomous != null || avgTeleop != null || avgEndgame != null || matchesPlayed > 0 || winRate != null || DPR != null || CCWM != null;
  if (!hasAny) return null;
  const first = arr[0];
  return {
    teamNumber: first.teamNumber,
    season: first.season,
    region: first.region,
    OPR,
    DPR,
    CCWM,
    avgAutonomous,
    avgTeleop,
    avgEndgame,
    matchesPlayed,
    winRate,
  };
}

export function toQuickStats(n: NormalizedQuickStats | null): {
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
} | null {
  if (!n) return null;
  return {
    teamNumber: n.teamNumber,
    season: n.season,
    region: n.region,
    OPR: n.OPR ?? 0,
    DPR: n.DPR ?? null,
    CCWM: n.CCWM ?? null,
    avgAutonomous: n.avgAutonomous ?? 0,
    avgTeleop: n.avgTeleop ?? 0,
    avgEndgame: n.avgEndgame ?? 0,
    matchesPlayed: n.matchesPlayed,
    winRate: n.winRate ?? 0,
  };
}
