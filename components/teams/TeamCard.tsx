"use client"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useI18n } from "@/components/i18n/LanguageProvider"

interface TeamCardProps {
  team: {
    id: string
    number: number
    name: string
    region?: string | null
    avatar_url?: string | null
    has_registered_user?: boolean
    quickStats?: {
      OPR?: number | null
      DPR?: number | null
      CCWM?: number | null
      avgAutonomous?: number | null
      avgEndgame?: number | null
      matches_played?: number | null
    } | null
  }
}

export function TeamCard({ team }: TeamCardProps) {
  const { t } = useI18n()
  return (
    <Link href={`/teams/${team.number}`}>
      <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-blue hover:bg-first-blue/10 hover:shadow-xl hover:shadow-first-blue/5 transition-all duration-200 cursor-pointer group hover:border-first-blue/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={team.avatar_url || undefined} />
                <AvatarFallback className="bg-first-blue/10 text-first-blue text-sm font-bold">
                  {team.number.toString().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl group-hover:text-first-blue transition-colors">
                    {t("teamCard.team", { number: team.number })}
                  </CardTitle>
                  {team.has_registered_user && (
                    <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" title={t("teamCard.registered")}>
                      {t("teamCard.registeredBadge")}
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2 mt-0.5">{team.name}</CardDescription>
              </div>
            </div>
            {team.region && (
              <Badge variant="outline" className="shrink-0 text-xs">{team.region}</Badge>
            )}
          </div>
        </CardHeader>
        {team.quickStats && (
          <CardContent className="pt-0">
            <div className="flex gap-2 flex-wrap">
              {(team.quickStats.OPR ?? null) != null && (
                <Badge variant="secondary" className="bg-first-blue/20 text-first-blue border-first-blue/30">
                  {t("teamCard.opr")}: {(team.quickStats.OPR ?? 0).toFixed(1)}
                </Badge>
              )}
              {(team.quickStats.DPR ?? null) != null && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                  {t("teamCard.dpr")}: {(team.quickStats.DPR ?? 0).toFixed(1)}
                </Badge>
              )}
              {(team.quickStats.CCWM ?? null) != null && (
                <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400">
                  {t("teamCard.ccwm")}: {(team.quickStats.CCWM ?? 0).toFixed(1)}
                </Badge>
              )}
              {(team.quickStats.avgAutonomous ?? null) != null && (
                <Badge variant="outline">
                  {t("teamCard.auto")}: {(team.quickStats.avgAutonomous ?? 0).toFixed(1)}
                </Badge>
              )}
              {(team.quickStats.avgEndgame ?? null) != null && (
                <Badge variant="outline">
                  {t("teamCard.endgame")}: {(team.quickStats.avgEndgame ?? 0).toFixed(1)}
                </Badge>
              )}
              {(team.quickStats.matches_played ?? 0) > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("teamCard.matches")}: {team.quickStats.matches_played}
                </Badge>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

