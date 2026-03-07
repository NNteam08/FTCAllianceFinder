"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClientComponentClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";

interface Message {
  id: string;
  chat_id: string;
  sender_team_id: string;
  message_type: "text" | "image" | "video" | "file";
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime_type: string | null;
  created_at: string;
  sender_team: {
    id: string;
    number: number;
    name: string;
    avatar_url: string | null;
  };
  sender_user: {
    id: string;
    display_name: string | null;
    email: string;
  } | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const supabase = createClientComponentClient();
  const { t } = useI18n();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [otherTeam, setOtherTeam] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("team_id")
        .eq("id", user.id)
        .single();

      if (!userData?.team_id) {
        router.push("/chat");
        return;
      }

      const teamId = userData.team_id;
      setMyTeamId(teamId);

      // Проверяем доступ к чату
      const { data: chat } = await supabase
        .from("team_chats")
        .select("*")
        .eq("id", chatId)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .single();

      if (!chat) {
        router.push("/chat");
        return;
      }

      const otherTeamId = chat.team_a_id === teamId ? chat.team_b_id : chat.team_a_id;

      // Загружаем сообщения
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender_team:teams!chat_messages_sender_team_id_fkey (id, number, name, avatar_url),
          sender_user:users!chat_messages_sender_user_id_fkey (id, display_name, email)
        `)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      setMessages((msgs || []) as Message[]);

      // Помечаем как прочитанные
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("chat_id", chatId)
        .neq("sender_team_id", teamId)
        .eq("is_read", false);

      const { data: otherTeamData } = await supabase
        .from("teams")
        .select("*")
        .eq("id", otherTeamId)
        .single();

      setOtherTeam(otherTeamData);
      setLoading(false);
    };

    loadData();
  }, [chatId, router, supabase]);

  // Подписка на realtime
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          // Загружаем полное сообщение с joins
          const { data } = await supabase
            .from("chat_messages")
            .select(`
              *,
              sender_team:teams!chat_messages_sender_team_id_fkey (id, number, name, avatar_url),
              sender_user:users!chat_messages_sender_user_id_fkey (id, display_name, email)
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (
    content?: string,
    messageType: "text" | "image" | "video" | "file" = "text",
    fileData?: { url: string; name: string; size: number; mimeType: string }
  ) => {
    if (!content && !fileData) return;
    if (!myTeamId) return;
    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({
          chat_id: chatId,
          sender_team_id: myTeamId,
          sender_user_id: user.id,
          message_type: messageType,
          content: content || null,
          file_url: fileData?.url || null,
          file_name: fileData?.name || null,
          file_size: fileData?.size || null,
          file_mime_type: fileData?.mimeType || null,
        })
        .select(`
          *,
          sender_team:teams!chat_messages_sender_team_id_fkey (id, number, name, avatar_url),
          sender_user:users!chat_messages_sender_user_id_fkey (id, display_name, email)
        `)
        .single();

      if (error) throw error;
      if (msg) setNewMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      alert(error?.message || t("chatDetail.chatError"));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage.trim());
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "chat-files");
      formData.append("folder", chatId);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t("chatDetail.uploadError"));
        return;
      }

      const data = await res.json();
      
      // Определяем тип сообщения
      let messageType: "image" | "video" | "file" = "file";
      if (data.fileType === "image") messageType = "image";
      if (data.fileType === "video") messageType = "video";

      await sendMessage(undefined, messageType, {
        url: data.url,
        name: data.fileName,
        size: data.fileSize,
        mimeType: data.mimeType,
      });
    } catch (error) {
      console.error("Upload error:", error);
      alert(t("chatDetail.uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <Card className="mb-4">
        <CardHeader className="py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chat">← {t("chatDetail.back")}</Link>
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherTeam?.avatar_url || undefined} />
              <AvatarFallback className="bg-first-blue text-white">
                {otherTeam?.number}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                Team {otherTeam?.number}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{otherTeam?.name}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {t("chatDetail.startDialog")}
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_team_id === myTeamId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isMe
                        ? "bg-first-blue text-white rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    {/* Отправитель */}
                    {!isMe && (
                      <div className="text-xs font-medium mb-1 opacity-70">
                        Team {msg.sender_team.number}
                        {msg.sender_user?.display_name && ` • ${msg.sender_user.display_name}`}
                      </div>
                    )}

                    {/* Контент */}
                    {msg.message_type === "text" && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    {msg.message_type === "image" && msg.file_url && (
                      <div className="space-y-2">
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.file_url}
                            alt={msg.file_name || "Image"}
                            className="max-w-full rounded-lg max-h-64 object-contain"
                          />
                        </a>
                        {msg.content && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                      </div>
                    )}

                    {msg.message_type === "video" && msg.file_url && (
                      <div className="space-y-2">
                        <video
                          src={msg.file_url}
                          controls
                          className="max-w-full rounded-lg max-h-64"
                        />
                        {msg.content && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                      </div>
                    )}

                    {msg.message_type === "file" && msg.file_url && (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 ${isMe ? "text-white" : "text-foreground"}`}
                      >
                        <span className="text-sm font-medium">{t("chatDetail.attach")}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{msg.file_name}</div>
                          {msg.file_size && (
                            <div className="text-xs opacity-70">
                              {formatFileSize(msg.file_size)}
                            </div>
                          )}
                        </div>
                      </a>
                    )}

                    {/* Время */}
                    <div className={`text-xs mt-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input */}
      <Card className="mt-4">
        <CardContent className="py-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*,application/pdf"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={t("chatDetail.attach")}
            >
              {uploading ? "..." : "+"}
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t("chatDetail.placeholder")}
              disabled={sending || uploading}
              className="flex-1"
            />
            <Button type="submit" disabled={sending || uploading || !newMessage.trim()}>
              {sending ? "..." : t("chatDetail.send")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
