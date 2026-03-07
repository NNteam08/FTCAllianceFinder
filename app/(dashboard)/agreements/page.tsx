"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClientComponentClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function AgreementsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // Загружаем команду пользователя
      const { data: userData } = await supabase
        .from("users")
        .select("*, teams(*)")
        .eq("id", user.id)
        .single();

      if (userData?.teams) {
        const teamObj = Array.isArray(userData.teams) ? userData.teams[0] : userData.teams;
        if (teamObj) {
          setTeam(teamObj);
          const teamId = teamObj.id;

        // Загружаем входящие соглашения
        const { data: incomingData } = await supabase
          .from("pre_match_agreements")
          .select(`
            *,
            events (*),
            teams!pre_match_agreements_sender_team_id_fkey (*)
          `)
          .eq("receiver_team_id", teamId)
          .order("created_at", { ascending: false });

        if (incomingData) setIncoming(incomingData);

        // Загружаем исходящие соглашения
        const { data: outgoingData } = await supabase
          .from("pre_match_agreements")
          .select(`
            *,
            events (*),
            teams!pre_match_agreements_receiver_team_id_fkey (*)
          `)
          .eq("sender_team_id", teamId)
          .order("created_at", { ascending: false });

        if (outgoingData) setOutgoing(outgoingData);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  const handleResponse = async (agreementId: string, status: "accepted" | "rejected") => {
    const { error } = await supabase
      .from("pre_match_agreements")
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq("id", agreementId);

    if (!error) {
      router.refresh();
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>;
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t("agreements.noTeam")}</p>
        <Button asChild className="bg-first-blue hover:bg-first-blue/90 text-white">
          <Link href="/teams">{t("agreements.findTeam")}</Link>
        </Button>
      </div>
    );
  }

  const pendingCount = incoming.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl flex-1">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("agreements.title")}</h1>
          <p className="text-white/90 text-lg">{t("agreements.subtitle")}</p>
        </div>
        <Button asChild className="bg-white/20 hover:bg-white/30 text-white border-0 shrink-0 self-center">
          <Link href="/agreements/new">{t("agreements.new")}</Link>
        </Button>
      </div>

      <Tabs defaultValue="incoming" className="w-full">
        <TabsList>
          <TabsTrigger value="incoming">
            {t("agreements.incomingCount", { count: pendingCount })}
          </TabsTrigger>
          <TabsTrigger value="outgoing">{t("agreements.outgoing")}</TabsTrigger>
          <TabsTrigger value="history">{t("agreements.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-4">
          {pendingCount === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("agreements.noIncomingRequests")}
              </CardContent>
            </Card>
          ) : (
            incoming
              .filter((a) => a.status === "pending")
              .map((agreement) => (
                <Card key={agreement.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          Team {agreement.teams?.number} - {agreement.teams?.name}
                        </CardTitle>
                        <CardDescription>
                          {t("agreements.eventLabel")} {agreement.events?.name}
                        </CardDescription>
                      </div>
                      {agreement.compatibility_score && (
                        <Badge variant="secondary">
                          {t("agreements.compatibilityLabel")} {agreement.compatibility_score.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{agreement.message}</p>
                    {agreement.video_url && (
                      <div>
                        <a
                          href={agreement.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {t("agreements.watchVideo")} →
                        </a>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleResponse(agreement.id, "accepted")}
                        className="flex-1"
                      >
                        {t("agreements.accept")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleResponse(agreement.id, "rejected")}
                        className="flex-1"
                      >
                        {t("agreements.reject")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4">
          {outgoing.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("agreements.noOutgoingRequests")}
              </CardContent>
            </Card>
          ) : (
            outgoing.map((agreement) => (
              <Card key={agreement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        Team {agreement.teams?.number} - {agreement.teams?.name}
                      </CardTitle>
                      <CardDescription>
                        {t("agreements.eventLabel")} {agreement.events?.name}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        agreement.status === "accepted"
                          ? "default"
                          : agreement.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {agreement.status === "pending"
                        ? t("agreements.statusPending")
                        : agreement.status === "accepted"
                        ? t("agreements.statusAccepted")
                        : t("agreements.statusRejected")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{agreement.message}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {[
            ...incoming.filter((a) => a.status !== "pending"),
            ...outgoing.filter((a) => a.status !== "pending"),
          ].length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("agreements.noHistory")}
              </CardContent>
            </Card>
          ) : (
            [...incoming.filter((a) => a.status !== "pending"), ...outgoing.filter((a) => a.status !== "pending")]
              .sort((a, b) => new Date(b.responded_at || b.created_at).getTime() - new Date(a.responded_at || a.created_at).getTime())
              .map((agreement) => (
                <Card key={agreement.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          Team {agreement.teams?.number || agreement.teams?.number}
                        </CardTitle>
                        <CardDescription>
                          {t("agreements.eventLabel")} {agreement.events?.name}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          agreement.status === "accepted"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {agreement.status === "accepted" ? t("agreements.statusAccepted") : t("agreements.statusRejected")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{agreement.message}</p>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}




