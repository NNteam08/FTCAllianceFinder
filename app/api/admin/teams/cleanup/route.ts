import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";

/**
 * Очистка данных команд
 * DELETE /api/admin/teams/cleanup?type=stats&season=2023&olderThan=30&dryRun=1
 * 
 * Параметры:
 * - type: 'stats' | 'old_stats' | 'all' - что очищать
 * - season: номер сезона (для old_stats)
 * - olderThan: дни (для old_stats - удалить статистику старше N дней)
 * - dryRun: 1 - только показать что будет удалено
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    
    // Проверка авторизации
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "old_stats";
    const seasonParam = searchParams.get("season");
    const olderThanParam = searchParams.get("olderThan");
    const dryRun = searchParams.get("dryRun") === "1";

    let deleted = 0;
    let message = "";

    if (type === "stats" || type === "old_stats") {
      // Удаляем статистику старше указанного количества дней или за старый сезон
      let query = supabase.from("quick_stats").select("id, team_id, season");

      if (seasonParam) {
        const season = parseInt(seasonParam, 10);
        query = query.eq("season", season);
      }

      if (olderThanParam) {
        const days = parseInt(olderThanParam, 10);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.lt("ftcscout_synced_at", cutoffDate.toISOString());
      } else if (!seasonParam) {
        // По умолчанию удаляем статистику за сезоны старше предыдущего
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        query = query.lt("season", previousYear);
      }

      const { data: statsToDelete, error: selectError } = await query;

      if (selectError) throw selectError;

      if (statsToDelete && statsToDelete.length > 0) {
        if (!dryRun) {
          const ids = statsToDelete.map(s => s.id);
          const { error: deleteError } = await supabase
            .from("quick_stats")
            .delete()
            .in("id", ids);

          if (deleteError) throw deleteError;
        }
        deleted = statsToDelete.length;
        message = `Deleted ${deleted} quick_stats records`;
      } else {
        message = "No stats to delete";
      }
    } else if (type === "all") {
      // Полная очистка (осторожно!)
      if (!dryRun) {
        // Удаляем статистику
        const { error: statsError } = await supabase.from("quick_stats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (statsError) throw statsError;

        // Удаляем участия в событиях
        const { error: participationsError } = await supabase.from("team_event_participations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (participationsError) throw participationsError;

        // Удаляем соглашения
        const { error: agreementsError } = await supabase.from("pre_match_agreements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (agreementsError) throw agreementsError;

        // Удаляем оценки совместимости
        const { error: compatibilityError } = await supabase.from("compatibility_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (compatibilityError) throw compatibilityError;

        // Удаляем избранные
        const { error: favoritesError } = await supabase.from("team_favorites").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (favoritesError) throw favoritesError;

        // Удаляем чаты и сообщения
        const { error: messagesError } = await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (messagesError) throw messagesError;

        const { error: chatsError } = await supabase.from("team_chats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (chatsError) throw chatsError;
      }

      message = dryRun ? "Would delete all data (dry run)" : "Deleted all data";
      deleted = -1; // -1 означает "все"
    }

    return NextResponse.json({
      success: true,
      dryRun,
      deleted,
      message,
    });
  } catch (error: any) {
    console.error("Error cleaning up:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup" },
      { status: 500 }
    );
  }
}
