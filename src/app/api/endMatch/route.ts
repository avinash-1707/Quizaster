import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import connectDB, { GameHistory } from "@/lib/mongodb";

type Match = { current_question: number };
type MatchQuestion = {
  questions: {
    id: string;
    text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
  } | null;
};

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

    // Get match questions with multiple choice options
    const { data, error: questionsError } = await supabase
      .from("match_questions")
      .select(
        `
    questions (
      id,
      text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer
    )
  `
      )
      .eq("match_id", matchId)
      .order("position");

    const matchQuestions = data as MatchQuestion[] | null;

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
    await connectDB();

    const gameHistoryData = {
      matchId: matchId,
      questions:
        matchQuestions
          ?.map((mq) => {
            if (!mq.questions) return null; // skip if null
            return {
              id: mq.questions.id,
              text: mq.questions.text,
              option_a: mq.questions.option_a,
              option_b: mq.questions.option_b,
              option_c: mq.questions.option_c,
              option_d: mq.questions.option_d,
              correct_answer: mq.questions.correct_answer,
            };
          })
          .filter(Boolean) || [],

      scores:
        scores?.map((score) => ({
          userId: score.user_id,
          points: score.points,
        })) || [],
      createdAt: new Date(),
    };

    const gameHistory = new GameHistory(gameHistoryData);
    await gameHistory.save();

    return NextResponse.json({
      saved: true,
      historyId: gameHistory._id,
      questionsCount: gameHistoryData.questions.length,
      playersCount: gameHistoryData.scores.length,
    });
  } catch (error) {
    console.error("Unexpected error in endMatch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
