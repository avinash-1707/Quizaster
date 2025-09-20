import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Create new match with host
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        current_question: 0,
        host_id: userId,
        status: "waiting",
      })
      .select()
      .single();

    if (matchError) {
      console.error("Error creating match:", matchError);
      return NextResponse.json(
        { error: "Failed to create match" },
        { status: 500 }
      );
    }

    // Get random questions (let's say 5 questions per match)
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .limit(5);

    if (questionsError) {
      console.error("Error fetching questions:", questionsError);
      return NextResponse.json(
        { error: "Failed to fetch questions" },
        { status: 500 }
      );
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: "No questions available" },
        { status: 500 }
      );
    }

    // Shuffle questions and assign to match
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
    const matchQuestions = shuffledQuestions.map((question, index) => ({
      match_id: match.id,
      question_id: question.id,
      position: index,
    }));

    const { error: matchQuestionsError } = await supabase
      .from("match_questions")
      .insert(matchQuestions);

    if (matchQuestionsError) {
      console.error("Error creating match questions:", matchQuestionsError);
      return NextResponse.json(
        { error: "Failed to assign questions to match" },
        { status: 500 }
      );
    }

    // Add creator to scores
    const { error: scoresError } = await supabase
      .from("scores")
      .insert({ match_id: match.id, user_id: userId, points: 0 });

    if (scoresError) {
      console.error("Error creating initial score:", scoresError);
      return NextResponse.json(
        { error: "Failed to create initial score" },
        { status: 500 }
      );
    }

    return NextResponse.json({ matchId: match.id });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
