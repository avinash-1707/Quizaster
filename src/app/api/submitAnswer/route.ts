import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MatchQuestion = {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

export async function POST(request: NextRequest) {
  try {
    const { matchId, questionId, userId, answer, timeLeft } =
      await request.json();

    if (!matchId || !questionId || !userId || !answer) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Get the correct answer for this question
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("correct_answer, option_a, option_b, option_c, option_d")
      .eq("id", questionId)
      .single<MatchQuestion>();

    if (questionError || !question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const isCorrect =
      answer.toUpperCase() === question.correct_answer.toUpperCase();
    const correctAnswerText =
      //@ts-ignore
      question[`option_${question.correct_answer.toLowerCase()}`];

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

    let pointsAwarded = 0;
    let streakBonus = 0;

    // If this is the first correct answer, calculate points and update score
    if (isFirst) {
      // Speed-based scoring: base 500 points + (timeLeft * 20) bonus points
      pointsAwarded = 500 + Math.max(0, (timeLeft || 0) * 20);

      // Get current streak
      const { data: currentScore, error: scoreError } = await supabase
        .from("scores")
        .select("current_streak, points")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .single();

      if (scoreError) {
        console.error("Error fetching current score:", scoreError);
        return NextResponse.json(
          { error: "Failed to fetch current score" },
          { status: 500 }
        );
      }

      const newStreak = (currentScore?.current_streak || 0) + 1;

      // Streak bonus: 100 points per streak level after 2
      if (newStreak >= 2) {
        streakBonus = (newStreak - 1) * 100;
        pointsAwarded += streakBonus;
      }

      // Update score with points and streak
      const { error: updateScoreError } = await supabase
        .from("scores")
        .update({
          points: (currentScore?.points || 0) + pointsAwarded,
          current_streak: newStreak,
        })
        .eq("match_id", matchId)
        .eq("user_id", userId);

      if (updateScoreError) {
        console.error("Error updating score:", updateScoreError);
        return NextResponse.json(
          { error: "Failed to update score" },
          { status: 500 }
        );
      }
    } else if (!isCorrect) {
      // Reset streak on incorrect answer
      const { error: resetStreakError } = await supabase
        .from("scores")
        .update({ current_streak: 0 })
        .eq("match_id", matchId)
        .eq("user_id", userId);

      if (resetStreakError) {
        console.error("Error resetting streak:", resetStreakError);
      }
    }

    return NextResponse.json({
      correct: isCorrect,
      first: isFirst,
      correctAnswer: question.correct_answer,
      correctAnswerText: correctAnswerText,
      pointsAwarded: pointsAwarded,
      streakBonus: streakBonus > 0 ? streakBonus : null,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
