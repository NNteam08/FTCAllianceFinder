"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { EventCard } from "@/components/events/EventCard"
import { createClientComponentClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/i18n/LanguageProvider"

export default function EventsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eventCode, setEventCode] = useState("")
  const [addingEvent, setAddingEvent] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Определяем текущий FTC сезон (начинается в сентябре)
  const getCurrentSeason = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() // 0-11
    return month < 8 ? year - 1 : year
  }

  const loadEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setEvents([])
        setLoading(false)
        return
      }

      const { data: userEventRows } = await supabase
        .from("user_events")
        .select("event_id")
        .eq("user_id", user.id)

      if (!userEventRows?.length) {
        setEvents([])
        setLoading(false)
        return
      }

      const eventIds = userEventRows.map((r: any) => r.event_id)
      const currentSeason = getCurrentSeason()

      const { data: dbEvents, error: evError } = await supabase
        .from("events")
        .select("*")
        .in("id", eventIds)
        .in("season", [currentSeason, currentSeason - 1])
        .order("start_date", { ascending: false, nullsFirst: false })

      if (evError) throw evError

      if (!dbEvents?.length) {
        setEvents([])
        setLoading(false)
        return
      }

      // Подсчёт участников по каждому событию
      const ids = dbEvents.map((e) => e.id)
      const { data: parts } = await supabase
        .from("team_event_participations")
        .select("event_id")
        .in("event_id", ids)
        .eq("is_confirmed", true)

      const countByEvent: Record<string, number> = {}
      for (const p of parts || []) {
        countByEvent[p.event_id] = (countByEvent[p.event_id] || 0) + 1
      }

      setEvents(
        dbEvents.map((e) => ({
          ...e,
          participantsCount: countByEvent[e.id] || 0,
        }))
      )
    } catch (error) {
      console.error("Error loading events:", error)
    } finally {
      setLoading(false)
    }
  }

  // Добавить событие вручную по коду
  const addEventByCode = async () => {
    if (!eventCode.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    setAddingEvent(true)
    setError(null)
    setSuccess(null)

    const code = eventCode.trim().toUpperCase()
    const currentSeason = getCurrentSeason()

    try {
      // Проверяем, есть ли уже такое событие
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("code", code)
        .single()

      if (existing) {
        await supabase.from("user_events").upsert({ user_id: user.id, event_id: existing.id }, { onConflict: "user_id,event_id" })
        setEventCode("")
        setSuccess(t("events.success.addedEvent", { code, season: currentSeason, teams: 0 }))
        await loadEvents()
        setAddingEvent(false)
        return
      }

      // Пробуем получить команды события из FTCScout (чтобы убедиться, что событие существует)
      let foundSeason = currentSeason
      let teamsCount = 0
      const teamsRes = await fetch(`/api/ftcscout/events/${currentSeason}/${code}/teams`)
      
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json()
        teamsCount = Array.isArray(teamsData) ? teamsData.length : 0
      } else {
        // Пробуем предыдущий сезон
        const prevRes = await fetch(`/api/ftcscout/events/${currentSeason - 1}/${code}/teams`)
        if (!prevRes.ok) {
          setError(t("events.error.notFoundSeason", { code, season: currentSeason, prevSeason: currentSeason - 1 }))
          setAddingEvent(false)
          return
        }
        foundSeason = currentSeason - 1
        const prevData = await prevRes.json()
        teamsCount = Array.isArray(prevData) ? prevData.length : 0
      }

      // Добавляем событие в БД
      const { data: newEvent, error: insertError } = await supabase
        .from("events")
        .insert({
          code: code,
          name: code, // Имя пока = код
          season: foundSeason,
          type: "qualifier",
        })
        .select("id")
        .single()

      if (insertError) throw insertError

      if (newEvent) {
        await supabase.from("user_events").upsert({ user_id: user.id, event_id: newEvent.id }, { onConflict: "user_id,event_id" })
      }

      setEventCode("")
      setSuccess(t("events.success.addedEvent", { code, season: foundSeason, teams: teamsCount }))
      await loadEvents()
    } catch (err: any) {
      console.error("Error adding event:", err)
      setError(err.message || t("events.error.add"))
    } finally {
      setAddingEvent(false)
    }
  }

  const clearAllEvents = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!confirm(t("events.clearConfirm") || "Очистить все данные поиска событий?")) return

    setClearing(true)
    try {
      await supabase.from("user_events").delete().eq("user_id", user.id)
      setEvents([])
      setError(null)
    } catch (e: any) {
      setError(e?.message || t("events.error.load"))
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl gradient-hero-warm p-6 md:p-8 text-white shadow-xl flex-1">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t("events.title")}
          </h1>
          <p className="text-white/90 text-lg">
            {t("events.subtitle")}
          </p>
        </div>
        {events.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAllEvents} disabled={clearing} className="text-destructive hover:text-destructive shrink-0 self-center bg-transparent border-white/30 text-white hover:bg-white/10">
            {clearing ? "..." : t("events.clearAll")}
          </Button>
        )}
      </div>

      {/* Форма добавления события вручную */}
      <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-blue">
        <CardHeader>
          <CardTitle>{t("events.add.title")}</CardTitle>
          <CardDescription>
            {t("events.add.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("events.add.placeholder")}
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addEventByCode()}
              className="max-w-[200px]"
            />
            <Button variant="outline" onClick={addEventByCode} disabled={addingEvent || !eventCode.trim()}>
              {addingEvent ? "..." : t("events.add.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t("events.loading")}</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20">
          <p className="text-muted-foreground mb-2">{t("events.empty.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("events.empty.desc")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

