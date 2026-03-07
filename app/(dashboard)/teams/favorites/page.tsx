"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from "@/lib/supabase/client"
import { TeamCard } from "@/components/teams/TeamCard"
import { useI18n } from "@/components/i18n/LanguageProvider"
import Link from "next/link"

export default function FavoritesPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadFavorites = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (!showLoading) setRefreshing(true)

    try {
      // Загружаем избранное напрямую через клиентский Supabase (как добавление — сессия уже в браузере)
      const { data: favoritesData, error } = await supabase
        .from("team_favorites")
        .select(`
          id,
          created_at,
          teams (
            id,
            number,
            name,
            region,
            rookie_year,
            avatar_url,
            quick_stats (
              season,
              opr,
              dpr,
              ccwm,
              avg_autonomous,
              avg_teleop,
              avg_endgame,
              matches_played,
              win_rate
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setFavorites(favoritesData || [])
    } catch (error) {
      console.error("Error loading favorites:", error)
      setFavorites([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [])

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl flex-1">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t("favorites.title")}
          </h1>
          <p className="text-white/90 text-lg">
            {t("favorites.subtitle")}
          </p>
        </div>
        {favorites.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadFavorites(false)}
            disabled={refreshing}
            className="shrink-0 self-center bg-white/20 border-white/30 text-white hover:bg-white/30"
          >
            {refreshing ? "..." : t("common.refresh")}
          </Button>
        )}
      </div>
      {favorites.length === 0 ? (
        <Card className="overflow-hidden border-0 bg-muted/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">{t("favorites.empty")}</p>
            <Button asChild className="bg-first-blue hover:bg-first-blue/90 text-white">
              <Link href="/teams">{t("favorites.browseTeams")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav: any) => {
            const team = fav.teams
            if (!team) return null

            // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
            const now = new Date()
            const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear()
            const stats = Array.isArray(team.quick_stats) 
              ? team.quick_stats.find((s: any) => s.season === currentSeason) || team.quick_stats[0]
              : null

            return (
              <TeamCard
                key={team.id}
                team={{
                  id: team.id,
                  number: team.number,
                  name: team.name,
                  region: team.region,
                  avatar_url: team.avatar_url,
                  has_registered_user: false, // Можно добавить проверку если нужно
                  quickStats: stats ? {
                    OPR: stats.opr,
                    DPR: stats.dpr,
                    CCWM: stats.ccwm,
                    avgAutonomous: stats.avg_autonomous,
                    avgEndgame: stats.avg_endgame,
                    matches_played: stats.matches_played,
                  } : null,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
