import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dbConnect from "@/lib/dbconnect";
import { GameHistory } from "@/schema/GameHistory";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json(
        { error: "Match ID is required" },
        { status: 400 }
      );
    }

    // Get match questions
    const { data: matchQuestions, error: questionsError } = await supabase
      .from("match_questions")
      .select(
        `
        questions (
          id,
          text,
          correct_answer
        )
      `
      )
      .eq("match_id", matchId)
      .order("position");

    if (questionsError) {
      console.error("Error fetching match questions:", questionsError);
      return NextResponse.json(
        { error: "Failed to fetch match questions" },
        { status: 500 }
      );
    }

    // Get final scores
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select("user_id, points")
      .eq("match_id", matchId);

    if (scoresError) {
      console.error("Error fetching scores:", scoresError);
      return NextResponse.json(
        { error: "Failed to fetch scores" },
        { status: 500 }
      );
    }

    // Connect to MongoDB and save game history
    await dbConnect();

    const gameHistoryData = {
      matchId: matchId,
      questions:
        matchQuestions?.map((mq) => ({
          id: mq.questions.id,
          text: mq.questions.text,
          correct_answer: mq.questions.correct_answer,
        })) || [],
      scores:
        scores?.map((score) => ({
          userId: score.user_id,
          points: score.points,
        })) || [],
      createdAt: new Date(),
    };

    const gameHistory = new GameHistory(gameHistoryData);
    await gameHistory.save();

    return NextResponse.json({ saved: true, historyId: gameHistory._id });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
