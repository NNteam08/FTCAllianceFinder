import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";

// GET /api/chat - список чатов текущей команды
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    
    // Получаем текущего пользователя и его команду
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!userData?.team_id) {
      return NextResponse.json({ error: "No team linked" }, { status: 400 });
    }

    const teamId = userData.team_id;

    // Получаем все чаты команды
    const { data: chats, error } = await supabase
      .from("team_chats")
      .select(`
        *,
        team_a:teams!team_chats_team_a_id_fkey (id, number, name, avatar_url),
        team_b:teams!team_chats_team_b_id_fkey (id, number, name, avatar_url)
      `)
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    // Преобразуем данные — определяем "другую" команду
    const formattedChats = (chats || []).map((chat) => {
      const otherTeam = chat.team_a_id === teamId ? chat.team_b : chat.team_a;
      return {
        id: chat.id,
        otherTeam,
        lastMessageAt: chat.last_message_at,
        createdAt: chat.created_at,
      };
    });

    // Добавляем количество непрочитанных сообщений
    for (const chat of formattedChats) {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chat.id)
        .neq("sender_team_id", teamId)
        .eq("is_read", false);
      
      (chat as any).unreadCount = count || 0;
    }

    return NextResponse.json(formattedChats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST /api/chat - создать или получить чат с командой
export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    const { otherTeamId } = await request.json();

    if (!otherTeamId) {
      return NextResponse.json({ error: "otherTeamId required" }, { status: 400 });
    }

    // Получаем текущего пользователя и его команду
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!userData?.team_id) {
      return NextResponse.json({ error: "No team linked" }, { status: 400 });
    }

    const teamId = userData.team_id;

    if (teamId === otherTeamId) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    // Используем функцию БД для получения/создания чата
    const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
      team1_id: teamId,
      team2_id: otherTeamId,
    });

    if (error) throw error;

    return NextResponse.json({ chatId });
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create chat" },
      { status: 500 }
    );
  }
}
