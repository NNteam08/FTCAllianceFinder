import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface AllianceAnalysisRequestBody {
  teamA: { number: number; OPR: number; avgAutonomous: number; avgEndgame: number; winRate: number; DPR?: number; CCWM?: number };
  teamB: { number: number; OPR: number; avgAutonomous: number; avgEndgame: number; winRate: number; DPR?: number; CCWM?: number };
  compatibilityScore: number;
  factors: { autonomousSynergy: number; endgameSynergy: number; winRateComplement: number; offensiveComplement: number };
  /** Язык ответа: "ru" | "en" — по выбранному в приложении */
  language?: "ru" | "en";
}

/**
 * POST /api/ai/alliance-analysis
 * GPT-анализ альянса двух команд. Требует OPENAI_API_KEY в .env.local
 */
export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI analysis unavailable: OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as AllianceAnalysisRequestBody;
    const { teamA, teamB, compatibilityScore, factors, language } = body;
    const lang = language === "en" ? "en" : "ru";
    if (!teamA || !teamB) {
      return NextResponse.json({ error: "Missing teamA or teamB" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const prompt = `Ты — эксперт по FTC (First Tech Challenge), анализирующий альянсы команд робототехники.

Две команды рассматривают альянс. Статистика:

Team ${teamA.number}: OPR=${teamA.OPR?.toFixed(1) ?? "?"}, автоном=${teamA.avgAutonomous?.toFixed(1) ?? "?"}, эндшпиль=${teamA.avgEndgame?.toFixed(1) ?? "?"}, винрейт=${(teamA.winRate != null ? (teamA.winRate <= 1 ? teamA.winRate * 100 : teamA.winRate) : "?")}%${teamA.DPR != null ? `, DPR=${teamA.DPR.toFixed(1)}` : ""}${teamA.CCWM != null ? `, CCWM=${teamA.CCWM.toFixed(1)}` : ""}

Team ${teamB.number}: OPR=${teamB.OPR?.toFixed(1) ?? "?"}, автоном=${teamB.avgAutonomous?.toFixed(1) ?? "?"}, эндшпиль=${teamB.avgEndgame?.toFixed(1) ?? "?"}, винрейт=${(teamB.winRate != null ? (teamB.winRate <= 1 ? teamB.winRate * 100 : teamB.winRate) : "?")}%${teamB.DPR != null ? `, DPR=${teamB.DPR.toFixed(1)}` : ""}${teamB.CCWM != null ? `, CCWM=${teamB.CCWM.toFixed(1)}` : ""}

Рассчитанный балл совместимости: ${compatibilityScore.toFixed(1)}% (по факторам: автоном=${factors?.autonomousSynergy ?? 0}, эндшпиль=${factors?.endgameSynergy ?? 0}, винрейт=${factors?.winRateComplement ?? 0}, OPR=${factors?.offensiveComplement ?? 0}).

Дай краткий (2–4 предложения) анализ: стоит ли этим двум командам заключать альянс? Учти синергию, комплементарность и риски. Ответь строго на языке: ${lang === "en" ? "English only." : "только по-русски."}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.6,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
    }

    return NextResponse.json({ analysis: text });
  } catch (e: unknown) {
    console.error("AI alliance analysis error:", e);
    const err = e as { status?: number; message?: string };
    if (err.status === 401) {
      return NextResponse.json({ error: "Invalid OpenAI API key" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err.message || "AI analysis failed" },
      { status: 500 }
    );
  }
}
