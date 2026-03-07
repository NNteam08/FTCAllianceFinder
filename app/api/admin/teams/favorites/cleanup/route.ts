import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";

/**
 * Очистка избранных команд
 * DELETE /api/admin/teams/favorites/cleanup?userId=xxx&all=1&dryRun=1
 * 
 * Параметры:
 * - userId: очистить избранные конкретного пользователя
 * - all: 1 - очистить все избранные всех пользователей
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
    const userId = searchParams.get("userId");
    const all = searchParams.get("all") === "1";
    const dryRun = searchParams.get("dryRun") === "1";

    let query = supabase.from("team_favorites").select("id, user_id, team_id");

    if (all) {
      // Очищаем все избранные
      query = query.neq("id", "00000000-0000-0000-0000-000000000000");
    } else if (userId) {
      // Очищаем избранные конкретного пользователя
      query = query.eq("user_id", userId);
    } else {
      return NextResponse.json(
        { error: "Specify userId or all=1" },
        { status: 400 }
      );
    }

    const { data: favoritesToDelete, error: selectError } = await query;

    if (selectError) throw selectError;

    let deleted = 0;
    if (favoritesToDelete && favoritesToDelete.length > 0) {
      if (!dryRun) {
        const ids = favoritesToDelete.map(f => f.id);
        const { error: deleteError } = await supabase
          .from("team_favorites")
          .delete()
          .in("id", ids);

        if (deleteError) throw deleteError;
      }
      deleted = favoritesToDelete.length;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      deleted,
      message: dryRun 
        ? `Would delete ${deleted} favorite entries` 
        : `Deleted ${deleted} favorite entries`,
    });
  } catch (error: any) {
    console.error("Error cleaning up favorites:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup favorites" },
      { status: 500 }
    );
  }
}
