import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * GET /api/teams/favorites — список избранных команд
 * POST /api/teams/favorites — добавить в избранное (body: { teamNumber })
 * DELETE /api/teams/favorites — убрать из избранного (body: { teamNumber })
 */
async function getSupabaseAndUser(request: NextRequest) {
  const supabase = await createRouteHandlerClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase: null, user: null, error: "Unauthorized - please log in" };
  }
  return { supabase, user, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getSupabaseAndUser(request);
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    // Получаем избранные команды
    const { data: favorites, error } = await supabase
      .from("team_favorites")
      .select(`
        id,
        created_at,
        teams (
          id,
          number,
          name,
          region,
          rookie_year,
          avatar_url,
          quick_stats (
            season,
            opr,
            avg_autonomous,
            avg_teleop,
            avg_endgame,
            matches_played,
            win_rate
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      favorites: favorites || [] 
    });
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getSupabaseAndUser(request);
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const teamNumber = parseInt(String(body.teamNumber ?? body.team_number));
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("team_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .single();

    if (existing) {
      revalidatePath(`/teams/${teamNumber}`);
      revalidatePath(`/teams/favorites`);
      return NextResponse.json({ success: true, isFavorite: true, message: "Already in favorites" });
    }

    const { error: insertError } = await supabase
      .from("team_favorites")
      .insert({ user_id: user.id, team_id: team.id });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    revalidatePath(`/teams/${teamNumber}`);
    revalidatePath(`/teams/favorites`);
    return NextResponse.json({ success: true, isFavorite: true, message: "Added to favorites" });
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add favorite" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getSupabaseAndUser(request);
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const teamNumber = parseInt(String(body.teamNumber ?? body.team_number));
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("team_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", team.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    revalidatePath(`/teams/${teamNumber}`);
    revalidatePath(`/teams/favorites`);
    return NextResponse.json({ success: true, isFavorite: false, message: "Removed from favorites" });
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove favorite" },
      { status: 500 }
    );
  }
}
