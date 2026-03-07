"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TeamCard } from "@/components/teams/TeamCard"
import { createClientComponentClient } from "@/lib/supabase/client"
import { useI18n } from "@/components/i18n/LanguageProvider"

export default function TeamsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [teams, setTeams] = useState<any[]>([])
  const [searchNumber, setSearchNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  /** Если FTCScout вернул 404 — показываем форму «Добавить вручную» для этого номера. */
  const [manualAddFor, setManualAddFor] = useState<number | null>(null)
  const [manualName, setManualName] = useState("")

  const handleSearch = async () => {
    if (!searchNumber) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    setLoading(true)
    setError(null)
    setManualAddFor(null)

    try {
      const teamNumber = parseInt(searchNumber)
      if (isNaN(teamNumber)) {
        setError(t("teams.error.invalidNumber"))
        return
      }

      const { syncTeamFromFtcScout } = await import("@/lib/teams/sync-from-ftcscout")
      const result = await syncTeamFromFtcScout(teamNumber, supabase, { timeoutMs: 40000 })

      if (result.notFound) {
        setManualAddFor(teamNumber)
        setManualName("")
        setSearchNumber("")
        return
      }
      if (!result.success) {
        if (result.error === "Timeout") {
          setError(t("teamDetail.refreshTimeout"))
        } else {
          setError(result.error || t("teams.error.search"))
        }
        return
      }

      if (result.statsSaved === 0) {
        setError(t("teams.error.saveStats"))
      }

      const { data: team } = await supabase.from("teams").select("id").eq("number", teamNumber).single()
      if (team) {
        await supabase.from("user_team_searches").upsert({ user_id: user.id, team_id: team.id }, { onConflict: "user_id,team_id" })
      }

      loadTeams()
      setSearchNumber("")
    } catch (err: any) {
      setError(err.message || t("teams.error.search"))
    } finally {
      setLoading(false)
    }
  }

  const handleManualAdd = async () => {
    if (manualAddFor == null) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    setError(null)
    try {
      const { data: existing } = await supabase.from("teams").select("id").eq("number", manualAddFor).single()
      if (existing) {
        await supabase.from("user_team_searches").upsert({ user_id: user.id, team_id: existing.id }, { onConflict: "user_id,team_id" })
        setManualAddFor(null)
        setManualName("")
        setSearchNumber("")
        loadTeams()
        return
      }
      const name = (manualName || "").trim() || `Team ${manualAddFor}`
      const { data: newTeam, error: insertErr } = await supabase
        .from("teams")
        .insert({ number: manualAddFor, name, region: null, rookie_year: null })
        .select("id")
        .single()
      if (insertErr) throw insertErr
      if (newTeam) {
        await supabase.from("user_team_searches").upsert({ user_id: user.id, team_id: newTeam.id }, { onConflict: "user_id,team_id" })
      }
      await loadTeams()
      setManualAddFor(null)
      setManualName("")
      setSearchNumber("")
    } catch (e: any) {
      setError(e?.message || t("teams.error.add"))
    }
  }

  const loadTeams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setTeams([])
        return
      }

      const now = new Date()
      const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear()
      const previousSeason = currentSeason - 1

      const { data: userTeams } = await supabase
        .from("user_team_searches")
        .select("team_id")
        .eq("user_id", user.id)

      if (!userTeams?.length) {
        setTeams([])
        return
      }

      const teamIds = userTeams.map((r: any) => r.team_id)

      const { data, error: queryError } = await supabase
        .from("teams")
        .select(`
          *,
          quick_stats (
            opr,
            dpr,
            ccwm,
            avg_autonomous,
            avg_teleop,
            avg_endgame,
            matches_played,
            win_rate,
            season
          )
        `)
        .in("id", teamIds)
        .order("number")

      if (queryError) {
        throw queryError
      }

      if (data) {
        setTeams(data.map(team => {
          // Статистика только по последним двум сезонам: текущий → предыдущий
          let stats = team.quick_stats?.find((s: any) => s.season === currentSeason)
          if (!stats && team.quick_stats?.length) {
            stats = team.quick_stats.find((s: any) => s.season === previousSeason)
          }
          
          // Числа из БД могут прийти как строки (Postgres/JSON)
          const n = (s: any, ...keys: string[]) => {
            for (const k of keys) {
              const v = s?.[k]
              if (v == null) continue
              if (typeof v === "number" && !Number.isNaN(v)) return v
              if (typeof v === "string" && v !== "") { const x = Number(v); if (!Number.isNaN(x)) return x }
            }
            return null
          }
          return {
            ...team,
            quickStats: stats ? {
              OPR: n(stats, "opr", "OPR"),
              DPR: n(stats, "dpr", "DPR"),
              CCWM: n(stats, "ccwm", "CCWM"),
              avgAutonomous: n(stats, "avg_autonomous", "avgAutonomous"),
              avgEndgame: n(stats, "avg_endgame", "avgEndgame"),
              matches_played: n(stats, "matches_played", "matchesPlayed") ?? 0,
            } : null
          }
        }))
      }
    } catch (error) {
      console.error("Error loading teams:", error)
      setError(t("teams.error.load"))
    }
  }

  const clearAllTeams = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!confirm(t("teams.clearConfirm") || "Очистить все данные поиска команд?")) return

    setClearing(true)
    try {
      await supabase.from("user_team_searches").delete().eq("user_id", user.id)
      setTeams([])
      setError(null)
    } catch (e: any) {
      setError(e?.message || t("teams.error.load"))
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl flex-1">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t("teams.title")}
          </h1>
          <p className="text-white/90 text-lg">
            {t("teams.subtitle")}
          </p>
        </div>
        {teams.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAllTeams} disabled={clearing} className="text-destructive hover:text-destructive shrink-0 self-center">
            {clearing ? "..." : t("teams.clearAll")}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">{t("teams.add.title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("teams.add.desc")}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="number"
            placeholder={t("teams.add.placeholder")}
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-xs"
          />
          <Button onClick={handleSearch} disabled={loading} className="bg-first-blue hover:bg-first-blue/90 text-white">
            {loading ? t("teams.add.searching") : t("teams.add.search")}
          </Button>
        </div>
      </div>

      {manualAddFor != null && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
            {t("teams.manual.title", { number: manualAddFor })}
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("teams.manual.name")}</label>
              <Input
                placeholder={`Team ${manualAddFor}`}
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                className="max-w-xs"
              />
            </div>
            <Button onClick={handleManualAdd} variant="default" className="bg-first-blue hover:bg-first-blue/90 text-white">
              {t("teams.manual.add")}
            </Button>
            <Button onClick={() => { setManualAddFor(null); setManualName(""); setError(null); }} variant="outline">
              {t("teams.manual.cancel")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">{t("teams.list.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>

      {teams.length === 0 && !loading && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/10">
          <p className="text-muted-foreground">{t("teams.empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("teams.empty.desc")}</p>
        </div>
      )}
    </div>
  )
}

