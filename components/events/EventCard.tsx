"use client"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { dateLocales } from "@/lib/i18n"
import { useI18n } from "@/components/i18n/LanguageProvider"

interface EventCardProps {
  event: {
    id: string
    code: string
    name: string
    start_date?: string | null
    end_date?: string | null
    location?: string | null
    type?: string | null
    participantsCount?: number
  }
}

const eventTypeLabels: Record<string, { ru: string; en: string }> = {
  qualifier: { ru: "Квалификация", en: "Qualifier" },
  regional: { ru: "Региональный", en: "Regional" },
  championship: { ru: "Чемпионат", en: "Championship" },
  scrimmage: { ru: "Тренировка", en: "Scrimmage" },
  premier: { ru: "Премьер", en: "Premier" },
}

export function EventCard({ event }: EventCardProps) {
  const { t, lang } = useI18n()
  return (
    <Link href={`/events/${event.code}`}>
      <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-orange hover:bg-first-orange/10 hover:shadow-xl hover:shadow-first-orange/5 transition-all duration-200 cursor-pointer group hover:border-first-orange/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl group-hover:text-first-orange transition-colors line-clamp-2">{event.name}</CardTitle>
              <CardDescription className="mt-0.5">{event.location || t("event.location.unknown")}</CardDescription>
            </div>
            {event.type && (
              <Badge variant="secondary" className="shrink-0 bg-first-orange/15 text-first-orange border-first-orange/30">
                {eventTypeLabels[event.type]?.[lang] || event.type}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm">
            {event.start_date && (
              <div className="flex items-center gap-2">
                <span>
                  {format(new Date(event.start_date), "d MMM yyyy", { locale: dateLocales[lang] })}
                  {event.end_date && event.end_date !== event.start_date && (
                    ` — ${format(new Date(event.end_date), "d MMM yyyy", { locale: dateLocales[lang] })}`
                  )}
                </span>
              </div>
            )}
            {event.participantsCount !== undefined && event.participantsCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t("event.participants")}:</span>
                <Badge variant="outline">{event.participantsCount}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

