import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";

// GET /api/chat/[chatId] - получить сообщения чата
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    const chatId = params.chatId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // для пагинации

    // Проверяем авторизацию
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

    // Проверяем, что пользователь имеет доступ к этому чату
    const { data: chat } = await supabase
      .from("team_chats")
      .select("*")
      .eq("id", chatId)
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .single();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found or access denied" }, { status: 404 });
    }

    // Получаем сообщения
    let query = supabase
      .from("chat_messages")
      .select(`
        *,
        sender_team:teams!chat_messages_sender_team_id_fkey (id, number, name, avatar_url),
        sender_user:users!chat_messages_sender_user_id_fkey (id, display_name, email)
      `)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    // Помечаем сообщения как прочитанные
    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("chat_id", chatId)
      .neq("sender_team_id", teamId)
      .eq("is_read", false);

    return NextResponse.json({
      messages: (messages || []).reverse(), // Возвращаем в хронологическом порядке
      chat: {
        id: chat.id,
        teamAId: chat.team_a_id,
        teamBId: chat.team_b_id,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat/[chatId] - отправить сообщение
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    const chatId = params.chatId;
    const body = await request.json();
    const { content, messageType, fileUrl, fileName, fileSize, fileMimeType } = body;

    // Проверяем авторизацию
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

    // Проверяем доступ к чату
    const { data: chat } = await supabase
      .from("team_chats")
      .select("*")
      .eq("id", chatId)
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .single();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found or access denied" }, { status: 404 });
    }

    // Создаём сообщение
    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        sender_team_id: teamId,
        sender_user_id: user.id,
        message_type: messageType || "text",
        content: content || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        file_mime_type: fileMimeType || null,
      })
      .select(`
        *,
        sender_team:teams!chat_messages_sender_team_id_fkey (id, number, name, avatar_url),
        sender_user:users!chat_messages_sender_user_id_fkey (id, display_name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
