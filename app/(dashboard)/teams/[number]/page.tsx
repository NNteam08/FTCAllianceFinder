"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@/lib/supabase/client"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useI18n } from "@/components/i18n/LanguageProvider"
import { BarChart2, TrendingUp, MapPin, Calendar, ChevronDown, Info } from "lucide-react"

export default function TeamPage() {
  const params = useParams()
  const router = useRouter()
  const teamNumber = parseInt(params.number as string)
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [team, setTeam] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [season, setSeason] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasRegisteredUser, setHasRegisteredUser] = useState(false)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [isMyTeam, setIsMyTeam] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [binding, setBinding] = useState(false)
  const [selfAssessment, setSelfAssessment] = useState<{
    percentiles: { OPR: number; DPR: number; CCWM: number; autonomous: number; endgame: number; winRate: number };
    strengths: string[];
    improvements: string[];
    summaryKey: string;
    season: number;
    sampleSize: number;
  } | null>(null)
  const [selfAssessmentLoading, setSelfAssessmentLoading] = useState(false)

  const loadTeam = async (skipLoading = false) => {
      if (!skipLoading) {
        setLoading(true)
      }
      try {
        // Проверяем текущего пользователя
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userData } = await supabase
            .from("users")
            .select("team_id")
            .eq("id", user.id)
            .single()
          if (userData?.team_id) {
            setMyTeamId(userData.team_id)
          }
        }

        // Загружаем из БД
        const { data: teamData } = await supabase
          .from("teams")
          .select(`
            *,
            quick_stats (*)
          `)
          .eq("number", teamNumber)
          .single()

        if (teamData) {
          setTeam(teamData)
          
          // Проверяем, есть ли зарегистрированные пользователи
          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("team_id", teamData.id)
          
          setHasRegisteredUser((count || 0) > 0)
          
          // Проверяем, это наша команда?
          if (user) {
            const { data: userData } = await supabase
              .from("users")
              .select("team_id")
              .eq("id", user.id)
              .single()
            setIsMyTeam(userData?.team_id === teamData.id)
            
            // Проверяем, в избранном ли команда
            const { data: favorite } = await supabase
              .from("team_favorites")
              .select("id")
              .eq("user_id", user.id)
              .eq("team_id", teamData.id)
              .single()
            setIsFavorite(!!favorite)
          }
          
          // Статистика по последним двум сезонам: приоритет — текущий, затем предыдущий
          // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
          const now = new Date()
          const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear()
          const previousSeason = currentSeason - 1

          let statsData = teamData.quick_stats?.find((s: any) => s.season === currentSeason)
          let foundSeason = currentSeason
          
          if (!statsData && teamData.quick_stats?.length) {
            statsData = teamData.quick_stats.find((s: any) => s.season === previousSeason)
            foundSeason = previousSeason
          }

          if (statsData) {
            // Читаем поля в обоих регистрах; поддерживаем number и строки с числами
            const num = (o: any, ...keys: string[]) => {
              for (const k of keys) {
                const v = o?.[k]
                if (v == null) continue
                if (typeof v === "number" && !Number.isNaN(v)) return v
                if (typeof v === "string" && v !== "") { const n = Number(v); if (!Number.isNaN(n)) return n }
              }
              return null
            }
            setStats({
              OPR: num(statsData, "opr", "OPR"),
              DPR: num(statsData, "dpr", "DPR"),
              CCWM: num(statsData, "ccwm", "CCWM"),
              avg_autonomous: num(statsData, "avg_autonomous", "avgAutonomous"),
              avg_teleop: num(statsData, "avg_teleop", "avgTeleop"),
              avg_endgame: num(statsData, "avg_endgame", "avgEndgame"),
              matches_played: num(statsData, "matches_played", "matchesPlayed") ?? 0,
              win_rate: num(statsData, "win_rate", "winRate"),
            })
            setSeason(foundSeason)
          } else {
            setStats(null)
            setSeason(null)
          }
        } else {
          // Если нет в БД, загружаем из FTCScout через API route
          const teamResponse = await fetch(`/api/ftcscout/teams/${teamNumber}`)
          if (!teamResponse.ok) {
            const errorData = await teamResponse.json().catch(() => ({}))
            throw new Error(errorData.error || t("teams.error.fetch", { number: teamNumber }))
          }
          const ftcscoutTeamData = await teamResponse.json()
          setTeam({ ...ftcscoutTeamData, number: teamNumber })
          
          // Статистика по последним двум сезонам: текущий → предыдущий
          // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
          const now2 = new Date()
          const currentSeason2 = now2.getMonth() < 8 ? now2.getFullYear() - 1 : now2.getFullYear()
          const previousSeason2 = currentSeason2 - 1
          let quickStats = null
          let foundSeason = currentSeason2

          let res = await fetch(`/api/ftcscout/teams/${teamNumber}/quick-stats?season=${currentSeason2}`)
          if (res.ok) {
            quickStats = await res.json()
          } else {
            res = await fetch(`/api/ftcscout/teams/${teamNumber}/quick-stats?season=${previousSeason2}`)
            if (res.ok) {
              quickStats = await res.json()
              foundSeason = previousSeason2
            }
          }
          
          if (quickStats) {
            // Нормализуем поля API (camelCase) в формат для отображения
            setStats({
              OPR: quickStats.OPR ?? quickStats.opr,
              DPR: quickStats.DPR ?? quickStats.dpr,
              CCWM: quickStats.CCWM ?? quickStats.ccwm,
              avg_autonomous: quickStats.avgAutonomous ?? quickStats.avg_autonomous,
              avg_teleop: quickStats.avgTeleop ?? quickStats.avg_teleop,
              avg_endgame: quickStats.avgEndgame ?? quickStats.avg_endgame,
              matches_played: quickStats.matchesPlayed ?? quickStats.matches_played ?? 0,
              win_rate: quickStats.winRate ?? quickStats.win_rate,
            })
            setSeason(foundSeason)
          } else {
            setStats(null)
            setSeason(null)
          }
        }
      } catch (error) {
        console.error("Error loading team:", error)
      } finally {
        if (!skipLoading) {
          setLoading(false)
        }
      }
    }

  useEffect(() => {
    if (!isNaN(teamNumber)) {
      loadTeam()
    }
  }, [teamNumber])

  useEffect(() => {
    if (!team?.number || selfAssessmentLoading) return
    setSelfAssessmentLoading(true)
    fetch(`/api/teams/${team.number}/self-assessment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSelfAssessment(data)
        else setSelfAssessment(null)
      })
      .catch(() => setSelfAssessment(null))
      .finally(() => setSelfAssessmentLoading(false))
  }, [team?.number])

  const startChat = async () => {
    if (!team?.id || !myTeamId) {
      alert(t("teamDetail.linkTeam"))
      return
    }
    if (isMyTeam) return

    setStartingChat(true)
    try {
      const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
        team1_id: myTeamId,
        team2_id: team.id,
      })
      if (error) throw error
      if (chatId) router.push(`/chat/${chatId}`)
      else alert(t("teamDetail.chatError"))
    } catch (error: any) {
      console.error("Error starting chat:", error)
      alert(error?.message || t("teamDetail.chatErrorGeneric"))
    } finally {
      setStartingChat(false)
    }
  }

  const toggleFavorite = async () => {
    if (!team?.id) return
    
    setFavoriteLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      if (isFavorite) {
        const { error } = await supabase
          .from("team_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("team_id", team.id)
        if (error) throw error
        setIsFavorite(false)
      } else {
        const { error } = await supabase
          .from("team_favorites")
          .insert({ user_id: user.id, team_id: team.id })
        if (error) throw error
        setIsFavorite(true)
      }
      await loadTeam(true)
      router.refresh()
    } catch (error: any) {
      console.error("Error toggling favorite:", error)
      alert(error?.message || t("teamDetail.favoriteError"))
    } finally {
      setFavoriteLoading(false)
    }
  }

  const bindToProfile = async () => {
    if (!team?.id) return

    setBinding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Нельзя перепривязаться: проверяем в БД, есть ли уже привязанная команда
      const { data: u } = await supabase.from("users").select("team_id").eq("id", user.id).single()
      if (u?.team_id && u.team_id !== team.id) {
        alert(t("teamDetail.bindAlreadyHave"))
        setBinding(false)
        return
      }

      // То же самое, что при регистрации: привязываем пользователя к команде
      await supabase
        .from("users")
        .update({ team_id: team.id })
        .eq("id", user.id)

      setMyTeamId(team.id)
      setIsMyTeam(true)
      router.refresh()
    } catch (err: any) {
      alert(err?.message || t("teamDetail.bindError"))
    } finally {
      setBinding(false)
    }
  }

  const refreshTeamData = async () => {
    if (!teamNumber) return

    setRefreshing(true)
    try {
      const result = await import("@/lib/teams/sync-from-ftcscout").then((m) =>
        m.syncTeamFromFtcScout(teamNumber, supabase, { timeoutMs: 40000 })
      )

      if (result.notFound) {
        alert(t("teamDetail.notFound"))
        return
      }
      if (!result.success) {
        if (result.error === "Timeout") {
          alert(t("teamDetail.refreshTimeout"))
        } else {
          alert(result.error || t("teamDetail.refreshError"))
        }
        return
      }

      await loadTeam(true)
      router.refresh()
    } catch (error: any) {
      console.error("Error refreshing team:", error)
      alert(error?.message || t("teamDetail.refreshError"))
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t("teamDetail.notFound")}</p>
        <Button asChild>
          <Link href="/teams">{t("teamDetail.backToList")}</Link>
        </Button>
      </div>
    )
  }

  const wins = stats?.matches_played && stats?.win_rate != null
    ? Math.round(stats.matches_played * (stats.win_rate <= 1 ? stats.win_rate : stats.win_rate / 100))
    : null
  const losses = stats?.matches_played && wins != null ? Math.round(stats.matches_played * (1 - (stats.win_rate <= 1 ? stats.win_rate : stats.win_rate / 100))) : null

  return (
    <div className="space-y-6">
      {/* Hero card — как в референсе */}
      <div className="rounded-2xl bg-gradient-to-br from-first-blue via-[#0052a3] to-[#003d7a] p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0 border-2 border-white/30">
              <AvatarImage src={team.avatar_url || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                {team.name?.slice(0, 2).toUpperCase() || team.number.toString().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {team.number} — {team.name}
              </h1>
              <div className="flex flex-wrap gap-4 mt-2 text-white/90 text-sm">
                {team.region && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {team.region}
                  </span>
                )}
                {team.rookie_year && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {t("teamDetail.founded")} {team.rookie_year}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isMyTeam && !myTeamId && (
              <Button onClick={bindToProfile} disabled={binding} variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                {binding ? "..." : t("teamDetail.bindToProfile")}
              </Button>
            )}
            {myTeamId && !isMyTeam && (
              <Button onClick={startChat} disabled={startingChat} variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                {startingChat ? "..." : t("teamDetail.write")}
              </Button>
            )}
            {isMyTeam && (
              <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                <Link href="/team/settings">{t("teamDetail.settings")}</Link>
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleFavorite}
              disabled={favoriteLoading}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {favoriteLoading ? "..." : isFavorite ? "★" : "☆"}
            </Button>
            <Button
              variant="secondary"
              onClick={refreshTeamData}
              disabled={refreshing}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {refreshing ? t("teamDetail.refreshing") : t("teamDetail.refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* Season selector */}
      {season != null && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 border">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {season}: {season === 2025 ? "DECODE" : season === 2024 ? "CENTERSTAGE" : season}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        </div>
      )}

      {/* Key stat cards — только то, что есть */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="overflow-hidden border-0 bg-first-blue/90 text-white">
          <CardContent className="p-6">
            <BarChart2 className="h-8 w-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold">{stats?.matches_played ?? 0}</div>
            <div className="font-medium mt-1">{t("teamDetail.matches")}</div>
            <div className="text-sm text-white/90 mt-0.5">{t("teamDetail.matchesSubtitle")}</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-0 bg-first-orange text-white">
          <CardContent className="p-6">
            <TrendingUp className="h-8 w-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold">
              {stats?.win_rate != null ? `${(stats.win_rate <= 1 ? stats.win_rate * 100 : stats.win_rate).toFixed(1)}%` : "—"}
            </div>
            <div className="font-medium mt-1">{t("teamDetail.winrate")}</div>
            <div className="text-sm text-white/90 mt-0.5">
              {wins != null && losses != null ? `${wins}-${losses}-0 (W-L-T)` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary — OPR, DPR, CCWM и показатели по периодам */}
      {stats && (
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            {t("teamDetail.summary")}
            <Info className="h-4 w-4 text-muted-foreground" />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: t("teamCard.opr"), value: stats.OPR ?? stats.opr, fmt: (v: number) => v?.toFixed(2) },
              { label: t("teamCard.dpr"), value: stats.DPR ?? stats.dpr, fmt: (v: number) => v?.toFixed(2) },
              { label: t("teamCard.ccwm"), value: stats.CCWM ?? stats.ccwm, fmt: (v: number) => v?.toFixed(2) },
              { label: t("teamCard.auto"), value: stats.avg_autonomous ?? stats.avgAutonomous, fmt: (v: number) => v?.toFixed(2) },
              { label: t("teamDetail.teleop"), value: stats.avg_teleop ?? stats.avgTeleop, fmt: (v: number) => v?.toFixed(2) },
              { label: t("teamCard.endgame"), value: stats.avg_endgame ?? stats.avgEndgame, fmt: (v: number) => v?.toFixed(2) },
            ].map(({ label, value, fmt }) => (
              <Card key={label} className="bg-muted/30 border-muted">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className={`text-2xl font-bold mt-1 ${value != null ? "" : "text-muted-foreground"}`}>
                    {value != null ? fmt(value) : "—"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {team.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teamDetail.about")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{team.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Social links */}
      {team.social_links && Object.values(team.social_links).some(Boolean) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teamDetail.links")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {team.social_links.youtube && (
                <a href={team.social_links.youtube} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer hover:bg-red-500/10">
                    YouTube
                  </Badge>
                </a>
              )}
              {team.social_links.instagram && (
                <a href={team.social_links.instagram} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer hover:bg-pink-500/10">
                    Instagram
                  </Badge>
                </a>
              )}
              {team.social_links.telegram && (
                <a href={team.social_links.telegram} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer hover:bg-blue-500/10">
                    Telegram
                  </Badge>
                </a>
              )}
              {team.social_links.website && (
                <a href={team.social_links.website} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-500/10">
                    {t("teamDetail.website")}
                  </Badge>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info & Representative */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-first-blue">
          <CardHeader>
            <CardTitle>{t("teamDetail.info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.region && (
              <div>
                <span className="text-muted-foreground">{t("teamDetail.region")} </span>
                <span>{team.region}</span>
              </div>
            )}
            {team.rookie_year && (
              <div>
                <span className="text-muted-foreground">{t("teamDetail.founded")} </span>
                <span>{team.rookie_year}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t("teamDetail.representative")} </span>
              <span>{hasRegisteredUser ? t("teamDetail.representativeYes") : t("teamDetail.representativeNo")}</span>
            </div>
          </CardContent>
        </Card>

        {!stats && (
          <Card>
            <CardHeader>
              <CardTitle>{t("teamDetail.stats")}</CardTitle>
              <CardDescription>{t("teamDetail.statsUnavailable")}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {stats && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-l-4 border-l-first-blue">
            <CardHeader>
              <CardTitle>{t("teamDetail.kpi")}</CardTitle>
              <CardDescription>OPR, DPR, CCWM</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    ...(stats.OPR != null || stats.opr != null ? [{ name: t("teamCard.opr"), value: Number(stats.OPR ?? stats.opr ?? 0) }] : []),
                    ...(stats.DPR != null || stats.dpr != null ? [{ name: t("teamCard.dpr"), value: Number(stats.DPR ?? stats.dpr ?? 0) }] : []),
                    ...(stats.CCWM != null || stats.ccwm != null ? [{ name: t("teamCard.ccwm"), value: Number(stats.CCWM ?? stats.ccwm ?? 0) }] : []),
                  ]}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [v.toFixed(1), t("teamDetail.value")]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#0066CC" />
                    <Cell fill="#3B82F6" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#10B981" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-first-orange">
            <CardHeader>
              <CardTitle>{t("teamDetail.periodScores")}</CardTitle>
              <CardDescription>{t("teamDetail.periodScoresDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { name: t("teamCard.auto"), value: Number(stats.avg_autonomous ?? stats.avgAutonomous ?? 0) },
                    { name: t("teamDetail.teleop"), value: Number(stats.avg_teleop ?? stats.avgTeleop ?? 0) },
                    { name: t("teamCard.endgame"), value: Number(stats.avg_endgame ?? stats.avgEndgame ?? 0) },
                  ]}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [v.toFixed(1), t("teamDetail.points")]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#0066CC" />
                    <Cell fill="#FF6600" />
                    <Cell fill="#6366f1" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Самооценка: сравнение с другими командами сезона */}
      {selfAssessmentLoading && (
        <Card className="border-l-4 border-l-first-blue">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("common.loading")} {t("selfAssessment.title")}…
          </CardContent>
        </Card>
      )}
      {!selfAssessmentLoading && selfAssessment && (
        <Card className="border-l-4 border-l-first-blue overflow-hidden">
          <CardHeader>
            <CardTitle>{t("selfAssessment.title")}</CardTitle>
            <CardDescription>
              {t("selfAssessment.subtitle")} · {t("selfAssessment.sampleSize", { count: selfAssessment.sampleSize })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">{t("selfAssessment.percentile")}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">OPR</span>
                  <span className="font-medium">{selfAssessment.percentiles.OPR}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">DPR</span>
                  <span className="font-medium">{selfAssessment.percentiles.DPR}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">CCWM</span>
                  <span className="font-medium">{selfAssessment.percentiles.CCWM}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">{t("teamCard.auto")}</span>
                  <span className="font-medium">{selfAssessment.percentiles.autonomous}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">{t("teamCard.endgame")}</span>
                  <span className="font-medium">{selfAssessment.percentiles.endgame}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">{t("teamDetail.winrate")}</span>
                  <span className="font-medium">{selfAssessment.percentiles.winRate}%</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t("selfAssessment.strengths")}</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                {selfAssessment.strengths.map((key) => (
                  <li key={key}>{t(key as Parameters<typeof t>[0])}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t("selfAssessment.improvements")}</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                {selfAssessment.improvements.map((key) => (
                  <li key={key}>{t(key as Parameters<typeof t>[0])}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm border-t pt-3 text-muted-foreground">
              {t("selfAssessment.summary")}: {t(selfAssessment.summaryKey as Parameters<typeof t>[0])}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-first-blue hover:bg-first-blue/90">
          <Link href={`/teams/compare?teams=${team.number}`}>
            {t("teamDetail.compare")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/teams">← {t("teamDetail.backToTeams")}</Link>
        </Button>
      </div>
    </div>
  )
}

