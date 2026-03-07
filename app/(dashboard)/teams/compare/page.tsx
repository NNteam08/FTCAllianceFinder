"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateCompatibility, quickStatsToTeamStats } from "@/lib/compatibility/calculator";
import { getAllianceAnalysis } from "@/lib/compatibility/analysis";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";

function CompareTeamsPageClient() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const initialTeams = searchParams.get("teams")?.split(",").map(Number).filter(Boolean) || [];

  const [teamNumbers, setTeamNumbers] = useState<number[]>(initialTeams);
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTeamNumber, setNewTeamNumber] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  const loadTeams = async () => {
    if (teamNumbers.length === 0) return;

    // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
    const now = new Date();
    const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const previousSeason = currentSeason - 1;

    setLoading(true);
    try {
      const teamsData = await Promise.all(
        teamNumbers.map(async (num) => {
          try {
            const teamRes = await fetch(`/api/ftcscout/teams/${num}`);
            const team = teamRes.ok ? await teamRes.json() : null;
            if (!team) return null;

            // Статистика по последним двум сезонам: пробуем текущий, затем предыдущий
            let statsRes = await fetch(`/api/ftcscout/teams/${num}/quick-stats?season=${currentSeason}`);
            if (!statsRes.ok) statsRes = await fetch(`/api/ftcscout/teams/${num}/quick-stats?season=${previousSeason}`);
            const quickStats = statsRes.ok ? await statsRes.json() : null;

            return { team, quickStats };
          } catch (error) {
            console.error(`Error loading team ${num}:`, error);
            return null;
          }
        })
      );

      const validData = teamsData.filter(Boolean);
      setTeams(validData.map(d => d!.team));
      setStats(validData.map(d => d!.quickStats));
    } catch (error) {
      console.error("Error loading teams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, [teamNumbers.join(",")]);

  const addTeam = () => {
    const num = parseInt(newTeamNumber);
    if (!isNaN(num) && !teamNumbers.includes(num)) {
      setTeamNumbers([...teamNumbers, num]);
      setNewTeamNumber("");
    }
  };

  const removeTeam = (num: number) => {
    setTeamNumbers(teamNumbers.filter(n => n !== num));
  };

  const fetchAIAnalysis = async (teamA: number, teamB: number, comp: {
    score: number; compatibility: ReturnType<typeof calculateCompatibility>;
  }, statsA: any, statsB: any) => {
    const key = `${teamA}-${teamB}`;
    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/ai/alliance-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA: {
            number: teamA,
            OPR: statsA?.OPR ?? statsA?.opr,
            avgAutonomous: statsA?.avgAutonomous ?? statsA?.avg_autonomous,
            avgEndgame: statsA?.avgEndgame ?? statsA?.avg_endgame,
            winRate: statsA?.winRate ?? statsA?.win_rate,
            DPR: statsA?.DPR ?? statsA?.dpr,
            CCWM: statsA?.CCWM ?? statsA?.ccwm,
          },
          teamB: {
            number: teamB,
            OPR: statsB?.OPR ?? statsB?.opr,
            avgAutonomous: statsB?.avgAutonomous ?? statsB?.avg_autonomous,
            avgEndgame: statsB?.avgEndgame ?? statsB?.avg_endgame,
            winRate: statsB?.winRate ?? statsB?.win_rate,
            DPR: statsB?.DPR ?? statsB?.dpr,
            CCWM: statsB?.CCWM ?? statsB?.ccwm,
          },
          compatibilityScore: comp.score,
          factors: comp.compatibility.factors,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis((prev) => ({ ...prev, [key]: data.analysis }));
      } else {
        setAiAnalysis((prev) => ({ ...prev, [key]: data.error || t("compare.aiUnavailable") }));
      }
    } catch {
      setAiAnalysis((prev) => ({ ...prev, [key]: t("compare.aiUnavailable") }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Данные для графиков
  const oprData = teams.map((team, idx) => ({
    name: `Team ${team.number}`,
    OPR: stats[idx]?.OPR ?? stats[idx]?.opr ?? 0,
    DPR: stats[idx]?.DPR ?? stats[idx]?.dpr ?? 0,
    CCWM: stats[idx]?.CCWM ?? stats[idx]?.ccwm ?? 0,
  }));

  const periodData = teams.map((team, idx) => ({
    name: `Team ${team.number}`,
    [t("teamCard.auto")]: stats[idx]?.avgAutonomous || 0,
    [t("teamDetail.teleop")]: stats[idx]?.avgTeleop || 0,
    [t("teamCard.endgame")]: stats[idx]?.avgEndgame || 0,
  }));

  // Расчёт совместимости для всех пар (с разбором и анализом)
  const compatibilityScores: Array<{
    teamA: number;
    teamB: number;
    score: number;
    compatibility: ReturnType<typeof calculateCompatibility>;
    analysis: ReturnType<typeof getAllianceAnalysis>;
  }> = [];

  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      if (stats[i] && stats[j]) {
        const teamAStats = quickStatsToTeamStats(stats[i]);
        const teamBStats = quickStatsToTeamStats(stats[j]);
        const compatibility = calculateCompatibility(teamAStats, teamBStats);
        const extendedA = {
          ...teamAStats,
          DPR: stats[i].DPR ?? stats[i].dpr ?? null,
          CCWM: stats[i].CCWM ?? stats[i].ccwm ?? null,
          avgTeleop: stats[i].avgTeleop ?? stats[i].avg_teleop,
        };
        const extendedB = {
          ...teamBStats,
          DPR: stats[j].DPR ?? stats[j].dpr ?? null,
          CCWM: stats[j].CCWM ?? stats[j].ccwm ?? null,
          avgTeleop: stats[j].avgTeleop ?? stats[j].avg_teleop,
        };
        const analysis = getAllianceAnalysis(extendedA, extendedB, compatibility);
        compatibilityScores.push({
          teamA: teams[i].number,
          teamB: teams[j].number,
          score: compatibility.score,
          compatibility,
          analysis,
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("compare.title")}</h1>
        <p className="text-white/90 text-lg">{t("compare.subtitle")}</p>
      </div>

      <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-blue">
        <CardHeader>
          <CardTitle>{t("compare.selectedTitle")}</CardTitle>
          <CardDescription>{t("compare.selectedDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="team-number">{t("compare.teamNumber")}</Label>
              <Input
                id="team-number"
                type="number"
                placeholder="12345"
                value={newTeamNumber}
                onChange={(e) => setNewTeamNumber(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addTeam()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addTeam} disabled={teamNumbers.length >= 3} className="bg-first-blue hover:bg-first-blue/90 text-white">
                {t("common.add")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {teamNumbers.map((num) => (
              <Badge key={num} variant="secondary" className="text-sm py-1 px-3">
                Team {num}
                <button
                  onClick={() => removeTeam(num)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-12">{t("compare.loading")}</div>
      )}

      {!loading && teams.length > 0 && (
        <Tabs defaultValue="stats" className="w-full">
          <TabsList>
            <TabsTrigger value="stats">{t("compare.tabStats")}</TabsTrigger>
            <TabsTrigger value="periods">{t("compare.tabPeriods")}</TabsTrigger>
            <TabsTrigger value="compatibility">{t("compare.tabCompatibility")}</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-4">
                <Card>
              <CardHeader>
                <CardTitle>{t("teamDetail.kpi")}</CardTitle>
                <CardDescription>OPR, DPR, CCWM</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={oprData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="OPR" fill="#0066CC" name={t("teamCard.opr")} />
                    <Bar dataKey="DPR" fill="#F59E0B" name={t("teamCard.dpr")} />
                    <Bar dataKey="CCWM" fill="#10B981" name={t("teamCard.ccwm")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team, idx) => (
                <Card key={team.number}>
                  <CardHeader>
                    <CardTitle>
                      <Link href={`/teams/${team.number}`} className="hover:underline">
                        Team {team.number}
                      </Link>
                    </CardTitle>
                    <CardDescription>{team.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats[idx] ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("teamCard.opr")}:</span>
                          <span className="font-semibold">{(stats[idx].OPR ?? stats[idx].opr)?.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("teamCard.dpr")}:</span>
                          <span className="font-semibold">{(stats[idx].DPR ?? stats[idx].dpr)?.toFixed(1) ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("teamCard.ccwm")}:</span>
                          <span className="font-semibold">{(stats[idx].CCWM ?? stats[idx].ccwm)?.toFixed(1) ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("teamDetail.matches")}:</span>
                          <span className="font-semibold">{stats[idx].matchesPlayed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("teamDetail.winrate")}:</span>
                          <span className="font-semibold">{stats[idx].winRate != null ? `${(stats[idx].winRate <= 1 ? stats[idx].winRate * 100 : stats[idx].winRate).toFixed(1)}%` : "N/A"}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("compare.statsUnavailable")}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="periods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("compare.periodScores")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={t("teamCard.auto")} fill="#0066CC" />
                    <Bar dataKey={t("teamDetail.teleop")} fill="#FF6600" />
                    <Bar dataKey={t("teamCard.endgame")} fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compatibility" className="space-y-4">
            {compatibilityScores.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {compatibilityScores.map((comp, idx) => {
                  const i = teams.findIndex((t) => t.number === comp.teamA);
                  const j = teams.findIndex((t) => t.number === comp.teamB);
                  const aiKey = `${comp.teamA}-${comp.teamB}`;
                  const aiText = aiAnalysis[aiKey];
                  const aiBusy = aiLoading[aiKey];
                  return (
                  <Card key={idx} className="overflow-hidden border-l-4 border-l-first-blue">
                    <CardHeader>
                      <CardTitle>
                        Team {comp.teamA} × Team {comp.teamB}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          comp.analysis.recommendation === "recommended"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : comp.analysis.recommendation === "caution"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {t(comp.analysis.verdictKey)}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">{t("compare.compatibility")}</span>
                          <span className="text-2xl font-bold">{comp.score.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-4">
                          <div
                            className={`h-4 rounded-full ${
                              comp.score >= 75
                                ? "bg-green-500"
                                : comp.score >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, comp.score)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1">{t("compare.howScoreTitle")}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{t("compare.howScoreDesc")}</p>
                        <ul className="space-y-1.5 text-sm">
                          {comp.compatibility.breakdown.map((row) => (
                            <li key={row.factorKey} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{t(row.labelKey)}</span>
                              <span>
                                {row.rawValue >= 0 ? "+" : ""}{row.rawValue} → {t("compare.factorContribution", { contribution: row.contribution >= 0 ? "+" + row.contribution.toFixed(1) : row.contribution.toFixed(1) })}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground mt-2 italic">{comp.compatibility.notes.slice(0, 2).map((n) => n).join(" • ")}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1">{t("compare.reasonsTitle")}</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                          {comp.analysis.reasons.map((key) => (
                            <li key={key}>{t(key)}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1">{t("compare.adviceTitle")}</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                          {comp.analysis.advice.map((key) => (
                            <li key={key}>{t(key)}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1">{t("compare.aiAnalysis")}</h4>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full mb-2"
                          onClick={() => fetchAIAnalysis(comp.teamA, comp.teamB, comp, stats[i], stats[j])}
                          disabled={aiBusy}
                        >
                          {aiBusy ? t("compare.aiLoading") : t("compare.aiButton")}
                        </Button>
                        {aiText && (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 italic">{aiText}</p>
                        )}
                      </div>

                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/agreements/new?team=${comp.teamB}`}>
                          {t("compare.sendAgreement")}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t("compare.addTwoTeams")}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!loading && teams.length === 0 && teamNumbers.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("compare.loadError")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CompareTeamsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
      <CompareTeamsPageClient />
    </Suspense>
  );
}




