import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { matchId, questionId, userId, answer } = await request.json();

    if (!matchId || !questionId || !userId || !answer) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Get the correct answer for this question
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("correct_answer")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const isCorrect =
      answer.toLowerCase().trim() ===
      question.correct_answer.toLowerCase().trim();

    // Check if there's already a correct answer for this question in this match
    const { data: existingCorrectAnswer, error: existingError } = await supabase
      .from("answers")
      .select("id")
      .eq("match_id", matchId)
      .eq("question_id", questionId)
      .eq("is_correct", true)
      .single();

    const isFirst = !existingCorrectAnswer && isCorrect;

    // Insert the answer
    const { error: answerError } = await supabase.from("answers").insert({
      match_id: matchId,
      question_id: questionId,
      user_id: userId,
      answer: answer,
      is_correct: isCorrect,
    });

    if (answerError) {
      console.error("Error inserting answer:", answerError);
      return NextResponse.json(
        { error: "Failed to save answer" },
        { status: 500 }
      );
    }

    // If this is the first correct answer, award a point
    if (isFirst) {
      const { error: scoreError } = await supabase
        .from("scores")
        .update({ points: supabase.raw("points + 1") })
        .eq("match_id", matchId)
        .eq("user_id", userId);

      if (scoreError) {
        console.error("Error updating score:", scoreError);
        return NextResponse.json(
          { error: "Failed to update score" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      correct: isCorrect,
      first: isFirst,
      correctAnswer: question.correct_answer,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
