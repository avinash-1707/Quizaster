import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Get current match
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("current_question")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Get total questions for this match
    const { data: totalQuestions, error: totalError } = await supabase
      .from("match_questions")
      .select("id")
      .eq("match_id", matchId);

    if (totalError) {
      return NextResponse.json(
        { error: "Failed to get match questions" },
        { status: 500 }
      );
    }

    const nextQuestionIndex = match.current_question + 1;

    // Check if match is completed
    if (nextQuestionIndex >= (totalQuestions?.length || 0)) {
      return NextResponse.json({
        matchCompleted: true,
        message: "Match completed",
      });
    }

    // Update current question
    const { error: updateError } = await supabase
      .from("matches")
      .update({ current_question: nextQuestionIndex })
      .eq("id", matchId);

    if (updateError) {
      console.error("Error updating current question:", updateError);
      return NextResponse.json(
        { error: "Failed to update current question" },
        { status: 500 }
      );
    }

    // Get the next question
    const { data: nextQuestion, error: nextQuestionError } = await supabase
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
      .eq("position", nextQuestionIndex)
      .single();

    if (nextQuestionError || !nextQuestion) {
      return NextResponse.json(
        { error: "Next question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      nextQuestionId: nextQuestion.questions.id,
      questionText: nextQuestion.questions.text,
      questionIndex: nextQuestionIndex,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
