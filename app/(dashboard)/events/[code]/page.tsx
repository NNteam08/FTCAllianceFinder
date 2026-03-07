"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientComponentClient } from "@/lib/supabase/client";
import { TeamCard } from "@/components/teams/TeamCard";
import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventCode = params.code as string;
  const supabase = createClientComponentClient();
  const { t } = useI18n();
  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oprFilter, setOprFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);

  // Определяем текущий FTC сезон
  const getCurrentSeason = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month < 8 ? year - 1 : year;
  };

  // Загрузка участников из БД
  const loadParticipants = async (eventId: string) => {
    const { data: participantsData, error } = await supabase
      .from("team_event_participations")
      .select(`
        *,
        teams (
          id,
          number,
          name,
          region,
          quick_stats (
            opr,
            avg_autonomous,
            avg_endgame,
            season
          )
        )
      `)
      .eq("event_id", eventId)
      .eq("is_confirmed", true);

    console.log("Loaded participations:", participantsData, error);

    if (participantsData && participantsData.length > 0) {
      const curr = getCurrentSeason();
      const prev = curr - 1;
      const teams = participantsData
        .filter((p) => p.teams != null) // Фильтруем записи без команд
        .map((p) => {
          const qs = p.teams?.quick_stats;
          const s = (Array.isArray(qs) && qs.find((x: any) => x.season === curr)) || 
                    (Array.isArray(qs) && qs.find((x: any) => x.season === prev));
          return {
            id: p.teams.id,
            number: p.teams.number,
            name: p.teams.name,
            region: p.teams.region,
            quickStats: s ? {
              OPR: s.opr ?? s.OPR,
              avgAutonomous: s.avg_autonomous ?? s.avgAutonomous,
              avgEndgame: s.avg_endgame ?? s.avgEndgame,
            } : null,
          };
        });
      console.log("Processed teams:", teams);
      setParticipants(teams);
    } else {
      setParticipants([]);
    }
  };

  // Синхронизация участников из FTCScout
  const syncParticipantsFromFTCScout = async () => {
    if (!event) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(false);

    try {
      const season = event.season || getCurrentSeason();
      const res = await fetch(`/api/ftcscout/events/${season}/${eventCode}/teams`);

      if (!res.ok) {
        setSyncError(true);
        setSyncMessage(t("eventDetail.syncFailLoad"));
        setSyncing(false);
        return;
      }

      const ftcTeams = await res.json();
      console.log("FTCScout teams:", ftcTeams);

      if (!Array.isArray(ftcTeams) || ftcTeams.length === 0) {
        setSyncError(true);
        setSyncMessage(t("eventDetail.syncNoParticipants"));
        setSyncing(false);
        return;
      }

      const totalTeams = ftcTeams.length;
      setSyncMessage(t("eventDetail.syncProgress", { processed: 0, total: totalTeams }));

      let added = 0;
      let processed = 0;
      
      for (const ftcTeam of ftcTeams) {
        const teamNumber = ftcTeam.teamNumber || ftcTeam.number;
        if (!teamNumber) continue;

        // Проверяем/создаём команду в БД
        let { data: existingTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("number", teamNumber)
          .single();

        if (!existingTeam) {
          // Получаем информацию о команде из FTCScout
          let teamName = `Team ${teamNumber}`;
          let teamRegion = null;
          
          try {
            const teamInfoRes = await fetch(`/api/ftcscout/teams/${teamNumber}`);
            if (teamInfoRes.ok) {
              const teamInfo = await teamInfoRes.json();
              teamName = teamInfo.name || teamName;
              teamRegion = teamInfo.region || teamInfo.location?.region || null;
            }
          } catch (e) {
            console.log("Could not fetch team info for", teamNumber);
          }

          // Создаём команду
          const { data: newTeam, error: teamError } = await supabase
            .from("teams")
            .insert({
              number: teamNumber,
              name: teamName,
              region: teamRegion,
            })
            .select("id")
            .single();

          if (teamError) continue;
          existingTeam = newTeam;
        }

        // Получаем статистику команды из FTCScout
        try {
          const statsRes = await fetch(`/api/ftcscout/teams/${teamNumber}/quick-stats?season=${season}`);
          if (statsRes.ok) {
            const stats = await statsRes.json();
            if (stats && (stats.OPR != null || stats.avgAutonomous != null)) {
              await supabase
                .from("quick_stats")
                .upsert({
                  team_id: existingTeam.id,
                  season: season,
                  opr: stats.OPR,
                  avg_autonomous: stats.avgAutonomous,
                  avg_teleop: stats.avgTeleop,
                  avg_endgame: stats.avgEndgame,
                  matches_played: stats.matchesPlayed,
                  win_rate: stats.winRate,
                }, {
                  onConflict: "team_id,season"
                });
            }
          }
        } catch (e) {
          console.log("Could not fetch stats for", teamNumber);
        }

        // Добавляем участие
        const { error: partError } = await supabase
          .from("team_event_participations")
          .upsert({
            team_id: existingTeam.id,
            event_id: event.id,
            is_confirmed: true,
          }, {
            onConflict: "team_id,event_id"
          });

        if (!partError) added++;
        
        processed++;
        if (processed % 5 === 0 || processed === totalTeams) {
          setSyncMessage(t("eventDetail.syncProgress", { processed, total: totalTeams }));
        }
      }

      setSyncMessage(t("eventDetail.syncDone", { count: added }));

      // Перезагружаем участников
      await loadParticipants(event.id);
      
      // Принудительное обновление страницы через 1 секунду если участники не загрузились
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncError(true);
      setSyncMessage(t("eventDetail.syncError"));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Загружаем событие
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("code", eventCode)
        .single();

      if (eventData) {
        setEvent(eventData);

        // Загружаем участников
        await loadParticipants(eventData.id);

        // Проверяем участие пользователя
        const { data: userData } = await supabase
          .from("users")
          .select("*, teams(*)")
          .eq("id", user.id)
          .single();

        if (userData?.teams) {
          const teamObj = Array.isArray(userData.teams) ? userData.teams[0] : userData.teams;
          if (teamObj) {
            setUserTeam(teamObj);

            const { data: participation } = await supabase
              .from("team_event_participations")
              .select("*")
              .eq("team_id", teamObj.id)
              .eq("event_id", eventData.id)
            .eq("is_confirmed", true)
            .single();

            setIsParticipating(!!participation);
          }
        }
      }

      setLoading(false);
    };

    loadData();
  }, [eventCode, router, supabase]);

  const handleParticipate = async () => {
    if (!userTeam || !event) return;

    try {
      const { error } = await supabase
        .from("team_event_participations")
        .upsert(
          {
            team_id: userTeam.id,
            event_id: event.id,
            is_confirmed: true,
          },
          {
            onConflict: "team_id,event_id",
          }
        );

      if (error) throw error;

      setIsParticipating(true);
      router.refresh();
    } catch (error) {
      console.error("Error participating:", error);
      alert(t("eventDetail.markError"));
    }
  };

  const filteredParticipants = participants.filter((team) => {
    if (!oprFilter) return true;
    const opr = team.quickStats?.OPR;
    if (!opr) return false;
    return opr >= parseFloat(oprFilter);
  });

  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    const oprA = a.quickStats?.OPR || 0;
    const oprB = b.quickStats?.OPR || 0;
    return oprB - oprA;
  });

  if (loading) {
    return <div className="text-center py-12">{t("eventDetail.loading")}</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t("eventDetail.notFound")}</p>
        <Button asChild className="bg-first-blue hover:bg-first-blue/90 text-white">
          <Link href="/events">{t("eventDetail.backToEvents")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl gradient-hero-warm p-6 md:p-8 text-white shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.name}</h1>
        <div className="flex items-center gap-4 text-white/90">
          {event.start_date && (
            <span>
              {new Date(event.start_date).toLocaleDateString()}
              {event.end_date && ` - ${new Date(event.end_date).toLocaleDateString()}`}
            </span>
          )}
          {event.location && <span>{event.location}</span>}
          {event.type && (
            <Badge className="bg-white/20 text-white border-0">{event.type}</Badge>
          )}
        </div>
      </div>

      {userTeam && (
        <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-orange">
          <CardHeader>
            <CardTitle>{t("eventDetail.participation")}</CardTitle>
            <CardDescription>{t("eventDetail.participationDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isParticipating ? (
              <div className="flex items-center gap-2">
                <Badge variant="default">{t("eventDetail.youParticipate")}</Badge>
                <p className="text-sm text-muted-foreground">
                  {t("eventDetail.registeredForEvent", { number: userTeam.number })}
                </p>
              </div>
            ) : (
              <Button onClick={handleParticipate}>
                {t("eventDetail.iParticipate")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-0 bg-muted/30 border-l-4 border-l-first-blue">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("eventDetail.participants")}</CardTitle>
              <CardDescription>
                {t("eventDetail.participantsDesc", { count: participants.length })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={syncParticipantsFromFTCScout}
                disabled={syncing}
              >
                {syncing ? t("eventDetail.syncing") : t("eventDetail.syncFromFTC")}
              </Button>
              <Input
                type="number"
                placeholder={t("eventDetail.minOpr")}
                value={oprFilter}
                onChange={(e) => setOprFilter(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
          {syncMessage && (
            <div className={`mt-2 text-sm ${syncError ? "text-red-500" : "text-green-600"}`}>
              {syncMessage}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {sortedParticipants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("eventDetail.noParticipants")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedParticipants.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




