/**
 * Анализ альянса двух команд: причины и рекомендации.
 * Использует все доступные статы (OPR, DPR, CCWM, автоном, эндшпиль, винрейт)
 * и выдаёт аргументы «почему стоит/не стоит заключать альянс» и советы.
 */

import type { CompatibilityScore, TeamStats } from "./calculator";

export type AllianceRecommendation = "recommended" | "neutral" | "caution";

export interface ExtendedTeamStats extends TeamStats {
  DPR?: number | null;
  CCWM?: number | null;
  avgTeleop?: number;
}

export interface AllianceAnalysis {
  recommendation: AllianceRecommendation;
  /** Аргументы в пользу альянса или против */
  reasons: string[];
  /** Советы командам (что усилить, на что обратить внимание) */
  advice: string[];
  /** Краткий вердикт (ключ i18n или текст) */
  verdictKey: string;
}

/**
 * Сформировать анализ альянса по статам двух команд и результату совместимости.
 * Все строки — ключи i18n (например analysis.reason.oprStrong), чтобы UI переводил.
 */
export function getAllianceAnalysis(
  teamA: ExtendedTeamStats,
  teamB: ExtendedTeamStats,
  compatibility: CompatibilityScore
): AllianceAnalysis {
  const reasons: string[] = [];
  const advice: string[] = [];
  const score = compatibility.score;
  const f = compatibility.factors;

  // —— Рекомендация по баллу ——
  let recommendation: AllianceRecommendation = "neutral";
  if (score >= 75) recommendation = "recommended";
  else if (score < 50) recommendation = "caution";

  // —— Причины (аргументы) ——
  if (f.autonomousSynergy > 10) {
    reasons.push("analysis.reason.autoSynergy");
  } else if (f.autonomousSynergy < -5) {
    reasons.push("analysis.reason.autoWeak");
  }

  if (f.endgameSynergy > 10) {
    reasons.push("analysis.reason.endgameSynergy");
  } else if (f.endgameSynergy < -10) {
    reasons.push("analysis.reason.endgameWeak");
  }

  if (f.winRateComplement > 5) {
    reasons.push("analysis.reason.winRateHigh");
  } else if (f.winRateComplement < -5) {
    reasons.push("analysis.reason.winRateLow");
  }

  if (f.offensiveComplement > 10) {
    reasons.push("analysis.reason.oprStrong");
  } else if (f.offensiveComplement < -10) {
    reasons.push("analysis.reason.oprWeak");
  }

  // Дополнительно: разница в силах (комплементарность)
  const oprDiff = Math.abs(teamA.OPR - teamB.OPR);
  if (oprDiff > 30 && (teamA.OPR > 80 || teamB.OPR > 80)) {
    reasons.push("analysis.reason.oprComplementary");
  }

  const autoDiff = Math.abs(teamA.avgAutonomous - teamB.avgAutonomous);
  if (autoDiff > 15) {
    reasons.push("analysis.reason.autoComplementary");
  }

  const endgameDiff = Math.abs(teamA.avgEndgame - teamB.avgEndgame);
  if (endgameDiff > 20) {
    reasons.push("analysis.reason.endgameComplementary");
  }

  // DPR/CCWM если есть
  const ccwmA = teamA.CCWM ?? (teamA.OPR - (teamA.DPR ?? 0));
  const ccwmB = teamB.CCWM ?? (teamB.OPR - (teamB.DPR ?? 0));
  if (teamA.DPR != null && teamB.DPR != null) {
    const avgDpr = (teamA.DPR + teamB.DPR) / 2;
    if (avgDpr < 60) reasons.push("analysis.reason.defenseStrong");
    if (ccwmA > 20 && ccwmB > 20) reasons.push("analysis.reason.ccwmStrong");
  }

  // Если причин нет — нейтральный аргумент
  if (reasons.length === 0) {
    reasons.push("analysis.reason.neutral");
  }

  // —— Советы ——
  const avgAuto = (teamA.avgAutonomous + teamB.avgAutonomous) / 2;
  const avgEnd = (teamA.avgEndgame + teamB.avgEndgame) / 2;
  const avgOpr = (teamA.OPR + teamB.OPR) / 2;
  const avgWr = ((teamA.winRate ?? 0) + (teamB.winRate ?? 0)) / 2;

  if (avgAuto < 15) {
    advice.push("analysis.advice.improveAuto");
  }
  if (avgEnd < 15) {
    advice.push("analysis.advice.improveEndgame");
  }
  if (avgOpr < 70) {
    advice.push("analysis.advice.improveOpr");
  }
  if (avgWr < 0.4 && avgWr > 0) {
    advice.push("analysis.advice.consistency");
  }
  if (oprDiff > 40) {
    advice.push("analysis.advice.roles");
  }
  if (score >= 70) {
    advice.push("analysis.advice.strategy");
  }
  if (advice.length === 0) {
    advice.push("analysis.advice.general");
  }

  // Вердикт
  let verdictKey = "analysis.verdict.neutral";
  if (recommendation === "recommended") verdictKey = "analysis.verdict.recommended";
  else if (recommendation === "caution") verdictKey = "analysis.verdict.caution";

  return {
    recommendation,
    reasons,
    advice,
    verdictKey,
  };
}
