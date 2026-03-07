"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientComponentClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";
import { dateLocales } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { t, lang } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindNumber, setBindNumber] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

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

      const today = new Date().toISOString().split("T")[0];
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(5);

      setUpcomingEvents(events || []);

      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-first-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {t("dashboard.title")}
        </h1>
        <p className="text-white/90 text-lg">
          {t("dashboard.welcome", { email: user?.email ?? "" })}
        </p>
      </div>

      {team ? (
        <Card className="overflow-hidden border-0 bg-first-blue/20 border-l-4 border-l-first-blue">
          <CardHeader>
            <CardTitle>{t("dashboard.team.title")}</CardTitle>
            <CardDescription>{t("dashboard.team.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                Team {team.number} — {team.name}
              </p>
              {team.region && (
                <p className="text-muted-foreground">{t("dashboard.team.region", { region: team.region })}</p>
              )}
              <Button asChild className="mt-4 bg-first-blue hover:bg-first-blue/90 text-white">
                <Link href={`/teams/${team.number}`}>
                  {t("dashboard.team.profile")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 bg-first-orange/20 border-l-4 border-l-first-orange">
          <CardHeader>
            <CardTitle>{t("dashboard.link.title")}</CardTitle>
            <CardDescription>{t("dashboard.link.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const num = parseInt(bindNumber);
                if (isNaN(num)) {
                  setBindError(t("teams.error.invalidNumber"));
                  return;
                }
                setBinding(true);
                setBindError(null);
                try {
                  // То же самое, что при регистрации с номером команды
                  const { data: existingTeam } = await supabase
                    .from("teams")
                    .select("id")
                    .eq("number", num)
                    .single();

                  let teamId: string;

                  if (existingTeam) {
                    teamId = existingTeam.id;
                  } else {
                    const { data: newTeam, error: teamError } = await supabase
                      .from("teams")
                      .insert({ number: num, name: `Team ${num}` })
                      .select("id")
                      .single();

                    if (teamError) throw teamError;
                    if (!newTeam) throw new Error("Failed to create team");
                    teamId = newTeam.id;
                  }

                  await supabase
                    .from("users")
                    .update({ team_id: teamId })
                    .eq("id", user.id);

                  setBindNumber("");
                  const { data: userData } = await supabase.from("users").select("*, teams(*)").eq("id", user.id).single();
                  if (userData?.teams) {
                    const teamObj = Array.isArray(userData.teams) ? userData.teams[0] : userData.teams;
                    if (teamObj) setTeam(teamObj);
                  }
                  router.refresh();
                } catch (err: any) {
                  setBindError(err?.message || t("dashboard.link.bindError"));
                } finally {
                  setBinding(false);
                }
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="bindTeam" className="sr-only">{t("dashboard.link.bindPlaceholder")}</label>
                <Input
                  id="bindTeam"
                  type="number"
                  placeholder={t("dashboard.link.bindPlaceholder")}
                  value={bindNumber}
                  onChange={(e) => { setBindNumber(e.target.value); setBindError(null); }}
                  disabled={binding}
                  className="h-10"
                />
              </div>
              <Button type="submit" disabled={binding} className="bg-first-orange hover:bg-first-orange/90 text-white">
                {binding ? t("dashboard.link.binding") : t("dashboard.link.bind")}
              </Button>
            </form>
            {bindError && (
              <p className="text-sm text-destructive">{bindError}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("dashboard.link.findHint")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/teams">{t("dashboard.link.find")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {upcomingEvents.length > 0 && (
        <Card className="overflow-hidden border-0 bg-emerald-600/20 border-l-4 border-l-emerald-500">
          <CardHeader>
            <CardTitle>{t("dashboard.upcoming.title")}</CardTitle>
            <CardDescription>{t("dashboard.upcoming.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {upcomingEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.code}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium">{e.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.start_date ? format(new Date(e.start_date), "d MMM yyyy", { locale: dateLocales[lang] }) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/events">{t("dashboard.upcoming.all")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="overflow-hidden border-0 bg-muted/30 hover:bg-first-blue/10 hover:border-first-blue/50 transition-all border border-transparent">
          <CardHeader>
            <CardTitle>{t("dashboard.cards.teams.title")}</CardTitle>
            <CardDescription>{t("dashboard.cards.teams.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/teams">{t("dashboard.cards.teams.link")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-muted/30 hover:bg-first-orange/10 hover:border-first-orange/50 transition-all border border-transparent">
          <CardHeader>
            <CardTitle>{t("dashboard.cards.events.title")}</CardTitle>
            <CardDescription>{t("dashboard.cards.events.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/events">{t("dashboard.cards.events.link")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-muted/30 hover:bg-violet-600/10 hover:border-violet-500/50 transition-all border border-transparent">
          <CardHeader>
            <CardTitle>{t("dashboard.cards.agreements.title")}</CardTitle>
            <CardDescription>{t("dashboard.cards.agreements.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/agreements">{t("dashboard.cards.agreements.link")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

