/**
 * Алгоритм расчёта совместимости команд (v2)
 *
 * Использует непрерывное масштабирование вместо ступенчатых порогов,
 * чтобы получить реальный разброс баллов (не всё около 50%).
 *
 * Референсы для FTC: OPR ~70, автоном ~12, эндшпиль ~15, винрейт ~0.5.
 * Выше референса → бонус, ниже → штраф. Линейная интерполяция.
 */

import { QuickStats } from "../ftcscout/client";

export type FactorKey = "autonomous" | "endgame" | "winRate" | "offensive";

export interface FactorBreakdownItem {
  factorKey: FactorKey;
  labelKey: string;
  weight: number;
  rawValue: number;
  contribution: number;
  explanationKey: string;
}

export interface CompatibilityScore {
  score: number;
  factors: {
    autonomousSynergy: number;
    endgameSynergy: number;
    winRateComplement: number;
    offensiveComplement: number;
  };
  breakdown: FactorBreakdownItem[];
  notes: string[];
}

export interface TeamStats {
  OPR: number;
  avgAutonomous: number;
  avgTeleop: number;
  avgEndgame: number;
  matchesPlayed: number;
  winRate: number;
}

const WEIGHT_AUTONOMOUS = 0.25;
const WEIGHT_ENDGAME = 0.3;
const WEIGHT_WIN_RATE = 0.2;
const WEIGHT_OFFENSIVE = 0.25;

/** Референсные значения для FTC (примерно медиана) */
const REF_OPR = 65;
const REF_AUTO = 12;
const REF_ENDGAME = 14;
const REF_WIN_RATE = 0.48;

/** Диапазон вклада каждого фактора (от референса до экстремума) */
const RANGE_OPR = 50;      // 65±50 → 15–115
const RANGE_AUTO = 18;     // 12±18 → 0–30
const RANGE_ENDGAME = 22;  // 14±22 → 0–36
const RANGE_WIN_RATE = 0.4; // 0.48±0.4 → 0.08–0.88

/** Макс. вклад фактора (сырые баллы до взвешивания) — больше = сильнее разброс */
const MAX_CONTRIB_OPR = 50;
const MAX_CONTRIB_AUTO = 40;
const MAX_CONTRIB_ENDGAME = 50;
const MAX_CONTRIB_WIN_RATE = 30;

/**
 * Линейная шкала: value = ref → 0; value выше ref → положительный вклад; ниже → отрицательный.
 */
function linearScale(
  value: number,
  ref: number,
  range: number,
  maxContrib: number
): number {
  const diff = value - ref;
  const ratio = diff / range;
  return Math.max(-maxContrib, Math.min(maxContrib, ratio * maxContrib));
}

export function calculateCompatibility(
  teamA: TeamStats,
  teamB: TeamStats
): CompatibilityScore {
  const notes: string[] = [];
  const avgOPR = (teamA.OPR + teamB.OPR) / 2;
  const avgAuto = (teamA.avgAutonomous + teamB.avgAutonomous) / 2;
  const avgEnd = (teamA.avgEndgame + teamB.avgEndgame) / 2;
  const avgWR = (teamA.winRate + teamB.winRate) / 2;

  // Непрерывные вклады — каждое значение даёт свой вклад
  const offensiveRaw = linearScale(avgOPR, REF_OPR, RANGE_OPR, MAX_CONTRIB_OPR);
  const autoRaw = linearScale(avgAuto, REF_AUTO, RANGE_AUTO, MAX_CONTRIB_AUTO);
  const endgameRaw = linearScale(avgEnd, REF_ENDGAME, RANGE_ENDGAME, MAX_CONTRIB_ENDGAME);
  const winRateRaw = linearScale(avgWR, REF_WIN_RATE, RANGE_WIN_RATE, MAX_CONTRIB_WIN_RATE);

  const offContrib = offensiveRaw * WEIGHT_OFFENSIVE;
  const autoContrib = autoRaw * WEIGHT_AUTONOMOUS;
  const endContrib = endgameRaw * WEIGHT_ENDGAME;
  const wrContrib = winRateRaw * WEIGHT_WIN_RATE;

  let score = 50 + autoContrib + endContrib + wrContrib + offContrib;

  // Бонус за комплементарность: если одна команда сильна, другая слаба — это может быть плюс
  const diffAuto = Math.abs(teamA.avgAutonomous - teamB.avgAutonomous);
  const diffEnd = Math.abs(teamA.avgEndgame - teamB.avgEndgame);
  const diffOpr = Math.abs(teamA.OPR - teamB.OPR);
  if (diffAuto > 12 || diffEnd > 15 || diffOpr > 25) {
    score += 3;
    notes.push("Комплементарность: разные сильные стороны");
  }
  if (avgAuto > 22 && diffAuto < 8) {
    notes.push("Обе команды сильны в автономе");
  }
  if (avgEnd > 28 && diffEnd < 10) {
    notes.push("Отличная синергия в эндшпиле");
  }
  if (avgOPR > 95) {
    notes.push("Высокая атакующая мощь альянса");
  }
  if (avgWR > 0.65) {
    notes.push("Обе команды с высоким винрейтом");
  }
  if (avgOPR < 45 || avgAuto < 6 || avgEnd < 6 || avgWR < 0.3) {
    notes.push("Есть слабые места в статах");
  }

  score = Math.max(0, Math.min(100, score));

  const breakdown: FactorBreakdownItem[] = [
    {
      factorKey: "autonomous",
      labelKey: "compatibility.factor.autonomous",
      weight: WEIGHT_AUTONOMOUS,
      rawValue: Math.round(autoRaw * 10) / 10,
      contribution: Math.round(autoContrib * 10) / 10,
      explanationKey: getExplanationKey("auto", avgAuto, REF_AUTO),
    },
    {
      factorKey: "endgame",
      labelKey: "compatibility.factor.endgame",
      weight: WEIGHT_ENDGAME,
      rawValue: Math.round(endgameRaw * 10) / 10,
      contribution: Math.round(endContrib * 10) / 10,
      explanationKey: getExplanationKey("endgame", avgEnd, REF_ENDGAME),
    },
    {
      factorKey: "winRate",
      labelKey: "compatibility.factor.winRate",
      weight: WEIGHT_WIN_RATE,
      rawValue: Math.round(winRateRaw * 10) / 10,
      contribution: Math.round(wrContrib * 10) / 10,
      explanationKey: getExplanationKey("winRate", avgWR, REF_WIN_RATE),
    },
    {
      factorKey: "offensive",
      labelKey: "compatibility.factor.offensive",
      weight: WEIGHT_OFFENSIVE,
      rawValue: Math.round(offensiveRaw * 10) / 10,
      contribution: Math.round(offContrib * 10) / 10,
      explanationKey: getExplanationKey("opr", avgOPR, REF_OPR),
    },
  ];

  return {
    score: Math.round(score * 10) / 10,
    factors: {
      autonomousSynergy: Math.round(autoRaw * 10) / 10,
      endgameSynergy: Math.round(endgameRaw * 10) / 10,
      winRateComplement: Math.round(winRateRaw * 10) / 10,
      offensiveComplement: Math.round(offensiveRaw * 10) / 10,
    },
    breakdown,
    notes,
  };
}

function getExplanationKey(
  factor: "auto" | "endgame" | "winRate" | "opr",
  value: number,
  ref: number
): string {
  if (factor === "winRate") {
    if (value > 0.65) return "compatibility.explain.winRate.high";
    if (value > 0.45) return "compatibility.explain.winRate.medium";
    if (value < 0.35) return "compatibility.explain.winRate.low";
    return "compatibility.explain.winRate.neutral";
  }
  const above = value > ref;
  if (factor === "auto") {
    if (value > 22) return "compatibility.explain.auto.bothStrong";
    if (value < 6) return "compatibility.explain.auto.bothWeak";
    return above ? "compatibility.explain.auto.neutral" : "compatibility.explain.auto.neutral";
  }
  if (factor === "endgame") {
    if (value > 28) return "compatibility.explain.endgame.bothStrong";
    if (value < 6) return "compatibility.explain.endgame.bothWeak";
    return "compatibility.explain.endgame.neutral";
  }
  if (factor === "opr") {
    if (value > 95) return "compatibility.explain.offensive.high";
    if (value < 45) return "compatibility.explain.offensive.low";
    return "compatibility.explain.offensive.medium";
  }
  return "compatibility.explain.auto.neutral";
}

export function quickStatsToTeamStats(stats: QuickStats): TeamStats {
  return {
    OPR: stats.OPR,
    avgAutonomous: stats.avgAutonomous,
    avgTeleop: stats.avgTeleop,
    avgEndgame: stats.avgEndgame,
    matchesPlayed: stats.matchesPlayed,
    winRate: stats.winRate,
  };
}
