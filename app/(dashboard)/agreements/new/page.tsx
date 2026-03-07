"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClientComponentClient } from "@/lib/supabase/client";
import { calculateCompatibility, quickStatsToTeamStats } from "@/lib/compatibility/calculator";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n/LanguageProvider";

function NewAgreementPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [receiverTeamNumber, setReceiverTeamNumber] = useState(
    searchParams.get("team") || ""
  );
  const [receiverTeam, setReceiverTeam] = useState<any>(null);
  const [receiverStats, setReceiverStats] = useState<any>(null);
  const [compatibility, setCompatibility] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: userData } = await supabase
        .from("users")
        .select("*, teams(*)")
        .eq("id", user.id)
        .single();

      if (userData?.teams) {
        const teamObj = Array.isArray(userData.teams) ? userData.teams[0] : userData.teams;
        if (teamObj) setTeam(teamObj);
      }

      // Загружаем события
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .gte("start_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(20);

      if (eventsData) setEvents(eventsData);
    };

    loadData();
  }, [router, supabase]);

  useEffect(() => {
    const loadReceiverTeam = async () => {
      if (!receiverTeamNumber) return;

      const num = parseInt(receiverTeamNumber);
      if (isNaN(num)) return;

      setLoading(true);
      try {
        // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
        const now = new Date();
        const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
        const previousSeason = currentSeason - 1;

        const teamRes = await fetch(`/api/ftcscout/teams/${num}`);
        const teamData = teamRes.ok ? await teamRes.json() : null;
        setReceiverTeam(teamData);

        // Статистика по последним двум сезонам
        let statsRes = await fetch(`/api/ftcscout/teams/${num}/quick-stats?season=${currentSeason}`);
        if (!statsRes.ok) statsRes = await fetch(`/api/ftcscout/teams/${num}/quick-stats?season=${previousSeason}`);
        const stats = statsRes.ok ? await statsRes.json() : null;
        setReceiverStats(stats);

        // Рассчитываем совместимость (статистика моей команды — из последних двух сезонов)
        if (team && stats) {
          const teamStats = await supabase
            .from("quick_stats")
            .select("*")
            .eq("team_id", team.id)
            .in("season", [currentSeason, previousSeason])
            .order("season", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (teamStats.data) {
            const d = teamStats.data as Record<string, unknown>
            const n = (k: string, k2?: string) => { const v = d?.[k] ?? d?.[k2!]; if (v != null && typeof v === "number" && !Number.isNaN(v)) return v; if (typeof v === "string" && v !== "") { const x = Number(v); return Number.isNaN(x) ? 0 : x } return 0 }
            const myStats = quickStatsToTeamStats({
              OPR: n("opr", "OPR"),
              avgAutonomous: n("avg_autonomous", "avgAutonomous"),
              avgTeleop: n("avg_teleop", "avgTeleop"),
              avgEndgame: n("avg_endgame", "avgEndgame"),
              matchesPlayed: Math.max(0, Math.floor(Number(d?.matches_played ?? d?.matchesPlayed) || 0)),
              winRate: n("win_rate", "winRate"),
            } as any);

            const receiverTeamStats = quickStatsToTeamStats(stats);
            const comp = calculateCompatibility(myStats, receiverTeamStats);
            setCompatibility(comp);
          }
        }
      } catch (error) {
        console.error("Error loading receiver team:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReceiverTeam();
  }, [receiverTeamNumber, team, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiverTeamNumber || !message.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      // Находим или создаем команду-получателя
      let receiverTeamId: string;
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("id")
        .eq("number", parseInt(receiverTeamNumber))
        .single();

      if (existingTeam) {
        receiverTeamId = existingTeam.id;
      } else {
        // Создаем команду если её нет
        const { data: newTeam } = await supabase
          .from("teams")
          .insert({
            number: parseInt(receiverTeamNumber),
            name: receiverTeam?.name || `Team ${receiverTeamNumber}`,
            region: receiverTeam?.region || null,
          })
          .select()
          .single();

        if (!newTeam) throw new Error("Failed to create team");
        receiverTeamId = newTeam.id;
      }

      // Создаем соглашение
      const { error } = await supabase.from("pre_match_agreements").insert({
        event_id: selectedEvent || null,
        sender_team_id: team.id,
        receiver_team_id: receiverTeamId,
        message: message.trim(),
        video_url: videoUrl.trim() || null,
        compatibility_score: compatibility?.score || null,
        status: "pending",
      });

      if (error) throw error;

      router.push("/agreements");
    } catch (error: any) {
      console.error("Error creating agreement:", error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || t("agreementsNew.error");
      alert(`${t("agreementsNew.error")}\n\n${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("agreementsNew.title")}</h1>
        <p className="text-muted-foreground">{t("agreementsNew.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("agreementsNew.teamTitle")}</CardTitle>
            <CardDescription>{t("agreementsNew.teamDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="team-number">{t("agreementsNew.teamNumber")}</Label>
              <Input
                id="team-number"
                type="number"
                placeholder="12345"
                value={receiverTeamNumber}
                onChange={(e) => setReceiverTeamNumber(e.target.value)}
                required
              />
            </div>

            {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

            {receiverTeam && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      Team {receiverTeam.number} - {receiverTeam.name}
                    </p>
                    {receiverTeam.region && (
                      <p className="text-sm text-muted-foreground">
                        {receiverTeam.region}
                      </p>
                    )}
                  </div>
                  {compatibility && (
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {compatibility.score.toFixed(1)}%
                    </Badge>
                  )}
                </div>
                {compatibility && compatibility.notes.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {compatibility.notes.map((note: string, idx: number) => (
                      <p key={idx}>• {note}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("agreementsNew.eventTitle")}</CardTitle>
            <CardDescription>{t("agreementsNew.eventDescOptional")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder={t("agreementsNew.selectEventOptional")} />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} ({new Date(event.start_date).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("agreementsNew.messageTitle")}</CardTitle>
            <CardDescription>{t("agreementsNew.messageDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message">{t("agreementsNew.messageLabel")}</Label>
              <Textarea
                id="message"
                placeholder={t("agreementsNew.messagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                required
              />
            </div>
            <div>
              <Label htmlFor="video-url">{t("agreementsNew.videoUrl")}</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://youtube.com/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={submitting || !team}>
            {submitting ? t("agreementsNew.submitting") : t("agreementsNew.submit")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewAgreementPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
      <NewAgreementPageClient />
    </Suspense>
  );
}

