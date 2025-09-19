import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { matchId, userId } = await request.json();

    if (!matchId || !userId) {
      return NextResponse.json(
        { error: "Match ID and User ID are required" },
        { status: 400 }
      );
    }

    // Check if match exists
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Check if user is already in the match
    const { data: existingScore, error: existingError } = await supabase
      .from("scores")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .single();

    if (existingScore) {
      return NextResponse.json({ success: true, message: "Already in match" });
    }

    // Add user to scores
    const { error: scoresError } = await supabase
      .from("scores")
      .insert({ match_id: matchId, user_id: userId, points: 0 });

    if (scoresError) {
      console.error("Error joining match:", scoresError);
      return NextResponse.json(
        { error: "Failed to join match" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
