/**
 * Самооценка команды: сравнение с другими командами по сезону.
 * Считает процентили по OPR, DPR, CCWM, автоном, эндшпиль, винрейт
 * и формирует списки сильных сторон и рекомендаций.
 */

export interface TeamStatsRow {
  opr: number;
  dpr?: number | null;
  ccwm?: number | null;
  avg_autonomous: number;
  avg_teleop?: number;
  avg_endgame: number;
  matches_played?: number;
  win_rate?: number | null;
}

export interface Percentiles {
  OPR: number;   // 0–100, выше = лучше
  DPR: number;  // 0–100, ниже DPR лучше, поэтому процентиль "обратный": чем ниже DPR, тем выше процентиль
  CCWM: number;
  autonomous: number;
  endgame: number;
  winRate: number;
}

export interface SelfAssessmentResult {
  percentiles: Percentiles;
  /** Сильные стороны (ключи i18n) */
  strengths: string[];
  /** Над чем поработать (ключи i18n) */
  improvements: string[];
  /** Общий совет (ключ i18n) */
  summaryKey: string;
  season: number;
  sampleSize: number;
}

/**
 * Вычислить процентиль значения в массиве (0–100).
 * higherIsBetter: true для OPR, автоном, эндшпиль, винрейт, CCWM; false для DPR.
 */
function percentile(value: number, sorted: number[], higherIsBetter: boolean): number {
  if (sorted.length === 0) return 50;
  const arr = [...sorted].sort((a, b) => a - b);
  let countBelow = 0;
  for (const v of arr) {
    if (higherIsBetter && v < value) countBelow++;
    if (!higherIsBetter && v > value) countBelow++; // для DPR: чем ниже значение, тем лучше
  }
  return Math.round((countBelow / arr.length) * 100);
}

/**
 * Процентиль для "чем больше, тем лучше": доля команд с значением ниже данной.
 */
function percentileHigherBetter(value: number, allValues: number[]): number {
  const valid = allValues.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (valid.length === 0) return 50;
  const sorted = [...valid].sort((a, b) => a - b);
  let countBelow = 0;
  for (const v of sorted) {
    if (v < value) countBelow++;
  }
  return Math.round((countBelow / sorted.length) * 100);
}

/**
 * Процентиль для DPR: чем ниже DPR, тем лучше. Возвращаем "качество": 100 = лучший (низкий DPR).
 */
function percentileLowerBetter(value: number, allValues: number[]): number {
  const valid = allValues.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (valid.length === 0) return 50;
  const sorted = [...valid].sort((a, b) => a - b);
  let countAbove = 0;
  for (const v of sorted) {
    if (v > value) countAbove++;
  }
  return Math.round((countAbove / sorted.length) * 100);
}

/**
 * Самооценка команды по сравнению с массивом других команд того же сезона.
 * myStats — статы команды (одна запись), allStats — все команды сезона (включая нашу).
 */
export function computeSelfAssessment(
  myStats: TeamStatsRow,
  allStats: TeamStatsRow[],
  season: number
): SelfAssessmentResult {
  const oprValues = allStats.map((s) => s.opr).filter((v) => typeof v === "number");
  const dprValues = allStats.map((s) => s.dpr).filter((v) => typeof v === "number") as number[];
  const ccwmValues = allStats.map((s) => s.ccwm).filter((v) => typeof v === "number") as number[];
  const autoValues = allStats.map((s) => s.avg_autonomous).filter((v) => typeof v === "number");
  const endValues = allStats.map((s) => s.avg_endgame).filter((v) => typeof v === "number");
  const wrValues = allStats.map((s) => (s.win_rate != null ? (s.win_rate <= 1 ? s.win_rate : s.win_rate / 100) : NaN)).filter((v) => !Number.isNaN(v));

  const percentiles: Percentiles = {
    OPR: percentileHigherBetter(myStats.opr, oprValues),
    DPR: myStats.dpr != null ? percentileLowerBetter(myStats.dpr, dprValues) : 50,
    CCWM: myStats.ccwm != null ? percentileHigherBetter(myStats.ccwm, ccwmValues) : 50,
    autonomous: percentileHigherBetter(myStats.avg_autonomous, autoValues),
    endgame: percentileHigherBetter(myStats.avg_endgame, endValues),
    winRate: wrValues.length ? percentileHigherBetter(myStats.win_rate != null ? (myStats.win_rate <= 1 ? myStats.win_rate : myStats.win_rate / 100) : 0, wrValues) : 50,
  };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (percentiles.OPR >= 75) strengths.push("selfAssessment.strength.opr");
  else if (percentiles.OPR < 40) improvements.push("selfAssessment.improve.opr");

  if (percentiles.DPR >= 75) strengths.push("selfAssessment.strength.defense");
  else if (percentiles.DPR < 40 && myStats.dpr != null) improvements.push("selfAssessment.improve.defense");

  if (percentiles.CCWM >= 70) strengths.push("selfAssessment.strength.ccwm");
  else if (percentiles.CCWM < 40 && myStats.ccwm != null) improvements.push("selfAssessment.improve.ccwm");

  if (percentiles.autonomous >= 70) strengths.push("selfAssessment.strength.auto");
  else if (percentiles.autonomous < 40) improvements.push("selfAssessment.improve.auto");

  if (percentiles.endgame >= 70) strengths.push("selfAssessment.strength.endgame");
  else if (percentiles.endgame < 40) improvements.push("selfAssessment.improve.endgame");

  if (percentiles.winRate >= 65) strengths.push("selfAssessment.strength.winRate");
  else if (percentiles.winRate < 35 && myStats.win_rate != null) improvements.push("selfAssessment.improve.winRate");

  if (strengths.length === 0) strengths.push("selfAssessment.strength.general");
  if (improvements.length === 0) improvements.push("selfAssessment.improve.general");

  const topCount = [percentiles.OPR, percentiles.autonomous, percentiles.endgame].filter((p) => p >= 70).length;
  let summaryKey = "selfAssessment.summary.neutral";
  if (topCount >= 2 && percentiles.OPR >= 60) summaryKey = "selfAssessment.summary.strong";
  else if (improvements.length >= 3) summaryKey = "selfAssessment.summary.improve";

  return {
    percentiles,
    strengths,
    improvements,
    summaryKey,
    season,
    sampleSize: allStats.length,
  };
}
