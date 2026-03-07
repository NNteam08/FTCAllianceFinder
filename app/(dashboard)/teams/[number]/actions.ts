"use server"

import { createRouteHandlerClient } from "@/lib/supabase/server";
import { ftcscoutClient } from "@/lib/ftcscout/client";
import { revalidatePath } from "next/cache";

/**
 * Добавить команду в избранное
 */
export async function addToFavorites(teamNumber: number) {
  try {
    const supabase = await createRouteHandlerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized - please log in" };
    }

    // Находим команду
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (teamError || !team) {
      return { error: "Team not found" };
    }

    // Проверяем, есть ли уже в избранном
    const { data: existing } = await supabase
      .from("team_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .single();

    if (existing) {
      return { success: true, isFavorite: true, message: "Already in favorites" };
    }

    // Добавляем в избранное
    const { error: insertError } = await supabase
      .from("team_favorites")
      .insert({
        user_id: user.id,
        team_id: team.id,
      });

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath(`/teams/${teamNumber}`);
    revalidatePath(`/teams/favorites`);
    return { success: true, isFavorite: true, message: "Added to favorites" };
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    return { error: error.message || "Failed to add favorite" };
  }
}

/**
 * Удалить команду из избранного
 */
export async function removeFromFavorites(teamNumber: number) {
  try {
    const supabase = await createRouteHandlerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized - please log in" };
    }

    const teamNumberParsed = parseInt(String(teamNumber));
    if (isNaN(teamNumberParsed)) {
      return { error: "Invalid team number" };
    }

    // Находим команду
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumberParsed)
      .single();

    if (teamError || !team) {
      return { error: "Team not found" };
    }

    // Удаляем из избранного
    const { error: deleteError } = await supabase
      .from("team_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", team.id);

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath(`/teams/${teamNumberParsed}`);
    revalidatePath(`/teams/favorites`);
    return { success: true, isFavorite: false, message: "Removed from favorites" };
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    return { error: error.message || "Failed to remove favorite" };
  }
}

/**
 * Обновить данные команды из FTCScout
 * Не требует авторизации — обновление публичных данных команды.
 */
export async function refreshTeamData(teamNumber: number) {
  try {
    const supabase = await createRouteHandlerClient();

    const teamNumberParsed = parseInt(String(teamNumber));
    if (isNaN(teamNumberParsed)) {
      return { error: "Invalid team number" };
    }

    // Получаем данные команды из FTCScout
    let teamData: any = null;
    try {
      teamData = await ftcscoutClient.getTeam(teamNumberParsed);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return { error: "Team not found in FTCScout" };
      }
      throw e;
    }

    // Находим или создаем команду в БД
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumberParsed)
      .single();

    let teamId: string;

    if (existingTeam) {
      teamId = existingTeam.id;
      // Обновляем основную информацию
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: teamData.name || `Team ${teamNumberParsed}`,
          region: teamData.region || null,
          rookie_year: teamData.rookieYear || null,
        })
        .eq("id", teamId);

      if (updateError) throw updateError;
    } else {
      // Создаем новую команду
      const { data: newTeam, error: insertError } = await supabase
        .from("teams")
        .insert({
          number: teamNumberParsed,
          name: teamData.name || `Team ${teamNumberParsed}`,
          region: teamData.region || null,
          rookie_year: teamData.rookieYear || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      teamId = newTeam.id;
    }

    // Обновляем статистику за текущий и предыдущий сезон
    // FTC сезон начинается в сентябре: до сентября текущий сезон = прошлый год
    const now = new Date();
    const currentSeason = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const previousSeason = currentSeason - 1;
    const seasonsToSync = [currentSeason, previousSeason];

    const updatedSeasons: number[] = [];

    for (const seasonNum of seasonsToSync) {
      try {
        const quickStats = await ftcscoutClient.getTeamQuickStats(teamNumberParsed, seasonNum);
        
        const toNumOrNull = (v: unknown) => {
          const n = v != null && v !== "" ? Number(v) : undefined;
          return n != null && !Number.isNaN(n) ? n : null;
        };

        const { error: statsError } = await supabase
          .from("quick_stats")
          .upsert({
            team_id: teamId,
            season: seasonNum,
            region: quickStats.region || null,
            opr: toNumOrNull(quickStats.OPR),
            avg_autonomous: toNumOrNull(quickStats.avgAutonomous),
            avg_teleop: toNumOrNull(quickStats.avgTeleop),
            avg_endgame: toNumOrNull(quickStats.avgEndgame),
            matches_played: Math.max(0, Math.floor(quickStats.matchesPlayed || 0)),
            win_rate: toNumOrNull(quickStats.winRate),
            ftcscout_synced_at: new Date().toISOString(),
          }, {
            onConflict: "team_id,season",
          });

        if (!statsError) {
          updatedSeasons.push(seasonNum);
        }
      } catch (e: any) {
        // Игнорируем ошибки 404 для статистики (команда может не иметь данных за этот сезон)
        if (e.statusCode !== 404) {
          console.error(`Error updating stats for season ${seasonNum}:`, e);
        }
      }
    }

    revalidatePath(`/teams/${teamNumberParsed}`);
    revalidatePath(`/teams`);
    return { 
      success: true, 
      message: "Team data refreshed",
      updatedSeasons,
    };
  } catch (error: any) {
    console.error("Error refreshing team:", error);
    return { error: error.message || "Failed to refresh team data" };
  }
}
