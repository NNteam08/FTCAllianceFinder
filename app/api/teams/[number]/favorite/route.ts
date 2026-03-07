import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClientFromRequest } from "@/lib/supabase/server";

/**
 * Добавить/удалить команду из избранного
 * POST /api/teams/[number]/favorite - добавить
 * DELETE /api/teams/[number]/favorite - удалить
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamNumber = parseInt(params.number);
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    // Находим команду
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Проверяем, есть ли уже в избранном
    const { data: existing } = await supabase
      .from("team_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .single();

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        message: "Already in favorites",
        isFavorite: true 
      });
    }

    // Добавляем в избранное
    const { error: insertError } = await supabase
      .from("team_favorites")
      .insert({
        user_id: user.id,
        team_id: team.id,
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ 
      success: true, 
      message: "Added to favorites",
      isFavorite: true 
    });
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add favorite" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const supabase = await createRouteHandlerClientFromRequest(request);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("Auth error in favorite DELETE route:", authError);
      return NextResponse.json({ error: "Authentication error", details: authError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized - please log in" }, { status: 401 });
    }

    const teamNumber = parseInt(params.number);
    if (isNaN(teamNumber)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }

    // Находим команду
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("number", teamNumber)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Удаляем из избранного
    const { error: deleteError } = await supabase
      .from("team_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", team.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ 
      success: true, 
      message: "Removed from favorites",
      isFavorite: false 
    });
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove favorite" },
      { status: 500 }
    );
  }
}
