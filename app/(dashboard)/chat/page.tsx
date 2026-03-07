"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClientComponentClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";

interface Chat {
  id: string;
  otherTeam: {
    id: string;
    number: number;
    name: string;
    avatar_url: string | null;
  };
  lastMessageAt: string;
  unreadCount: number;
}

export default function ChatsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { t } = useI18n();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        // Проверяем команду пользователя
        const { data: userData } = await supabase
        .from("users")
        .select("team_id, teams(*)")
        .eq("id", user.id)
        .single();

      if (!userData?.teams) {
        setLoading(false);
        return;
      }

      const teamObj = Array.isArray(userData.teams) ? userData.teams[0] : userData.teams;
      if (!teamObj) {
        setLoading(false);
        return;
      }

      setTeam(teamObj);
      const teamId = userData.team_id;

      // Загружаем чаты напрямую через клиентский Supabase
      const { data: chatsData, error: chatsErr } = await supabase
        .from("team_chats")
        .select(`
          *,
          team_a:teams!team_chats_team_a_id_fkey (id, number, name, avatar_url),
          team_b:teams!team_chats_team_b_id_fkey (id, number, name, avatar_url)
        `)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .order("last_message_at", { ascending: false });

      if (chatsErr) throw chatsErr;

      const formatted = (chatsData || []).map((chat: any) => {
        const otherTeam = chat.team_a_id === teamId ? chat.team_b : chat.team_a;
        return {
          id: chat.id,
          otherTeam,
          lastMessageAt: chat.last_message_at,
          createdAt: chat.created_at,
          unreadCount: 0,
        };
      });

      // Добавляем количество непрочитанных
      for (const c of formatted) {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("chat_id", c.id)
          .neq("sender_team_id", teamId)
          .eq("is_read", false);
        c.unreadCount = count || 0;
      }

        setChats(formatted);
      } catch (error) {
        console.error("Error loading chats:", error);
        setChats([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router, supabase]);

  // Подписка на realtime обновления
  useEffect(() => {
    if (!team) return;

    const channel = supabase
      .channel("chat-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        async () => {
          // Перезагружаем чаты
          if (!team?.id) return;
          const { data } = await supabase
            .from("team_chats")
            .select(`*, team_a:teams!team_chats_team_a_id_fkey (id, number, name, avatar_url), team_b:teams!team_chats_team_b_id_fkey (id, number, name, avatar_url)`)
            .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
            .order("last_message_at", { ascending: false });
          const formatted = (data || []).map((chat: any) => {
            const otherTeam = chat.team_a_id === team.id ? chat.team_b : chat.team_a;
            return { id: chat.id, otherTeam, lastMessageAt: chat.last_message_at, createdAt: chat.created_at, unreadCount: 0 };
          });
          for (const c of formatted) {
            const { count } = await supabase.from("chat_messages").select("*", { count: "exact", head: true }).eq("chat_id", c.id).neq("sender_team_id", team.id).eq("is_read", false);
            c.unreadCount = count || 0;
          }
          setChats(formatted);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team, supabase]);

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>;
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t("chat.noTeam")}</p>
        <Button asChild className="bg-first-blue hover:bg-first-blue/90 text-white">
          <Link href="/teams">{t("chat.findTeam")}</Link>
        </Button>
      </div>
    );
  }

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl gradient-hero p-6 md:p-8 text-white shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("chat.title")}</h1>
        <p className="text-white/90 text-lg">
            {t("chat.subtitle")}
            {totalUnread > 0 && (
              <Badge className="ml-2 bg-amber-500/80 text-white border-0">
                {t("chat.newCount", { count: totalUnread })}
              </Badge>
            )}
          </p>
      </div>

      {chats.length === 0 ? (
        <Card className="overflow-hidden border-0 bg-muted/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">{t("chat.empty")}</p>
            <p className="text-sm text-muted-foreground">{t("chat.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chat/${chat.id}`}>
              <Card className="overflow-hidden border-0 bg-muted/30 hover:bg-first-blue/10 border-l-4 border-l-transparent hover:border-l-first-blue transition-all cursor-pointer">
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={chat.otherTeam.avatar_url || undefined} />
                    <AvatarFallback className="bg-first-blue text-white">
                      {chat.otherTeam.number}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Team {chat.otherTeam.number}
                      </span>
                      {chat.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.otherTeam.name}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(chat.lastMessageAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
