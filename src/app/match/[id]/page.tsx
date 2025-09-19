"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { Trophy, Users, Clock, Send, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Question {
  id: string;
  text: string;
  correct_answer: string;
}

interface Score {
  user_id: string;
  points: number;
}

interface Match {
  id: string;
  current_question: number;
}

export default function MatchPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    checkUser();
    fetchMatchData();

    // Set up real-time subscriptions
    const scoresChannel = supabase
      .channel(`match_scores_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `match_id=eq.${matchId}`,
        },
        () => fetchScores()
      )
      .subscribe();

    const matchChannel = supabase
      .channel(`match_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        () => {
          fetchMatchData();
          setHasAnswered(false);
          setAnswer("");
          setMessage("");
          resetTimer();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [matchId]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && currentQuestion && !hasAnswered) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentQuestion, hasAnswered]);

  const resetTimer = () => {
    setTimeLeft(30);
  };

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  };

  const fetchMatchData = async () => {
    try {
      // Get match details
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("id, current_question")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);

      // Get total questions count
      const { data: questionsCount, error: countError } = await supabase
        .from("match_questions")
        .select("id")
        .eq("match_id", matchId);

      if (countError) throw countError;
      setTotalQuestions(questionsCount?.length || 0);

      // Get current question
      const { data: questionData, error: questionError } = await supabase
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
        .eq("position", matchData.current_question)
        .single();

      if (questionError && questionError.code !== "PGRST116") {
        throw questionError;
      }

      if (questionData?.questions) {
        setCurrentQuestion(questionData.questions);
      } else {
        // Match completed
        router.push(`/match/${matchId}/results`);
      }

      await fetchScores();
    } catch (error) {
      console.error("Error fetching match data:", error);
      setMessage("Error loading match data");
    }
  };

  const fetchScores = async () => {
    try {
      const { data: scoresData, error: scoresError } = await supabase
        .from("scores")
        .select("user_id, points")
        .eq("match_id", matchId)
        .order("points", { ascending: false });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);

      // Check if current user is host (first to join)
      if (scoresData && scoresData.length > 0 && user) {
        setIsHost(scoresData[0].user_id === user.id);
      }
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || !user || !answer.trim() || hasAnswered) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/submitAnswer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          questionId: currentQuestion.id,
          userId: user.id,
          answer: answer.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasAnswered(true);
        if (data.correct) {
          if (data.first) {
            setMessage("🎉 Correct! You got the point!");
          } else {
            setMessage("✅ Correct, but someone else got there first!");
          }
        } else {
          setMessage(`❌ Incorrect. The answer was: ${data.correctAnswer}`);
        }
      } else {
        setMessage(data.error || "Error submitting answer");
      }
    } catch (error) {
      setMessage("Error submitting answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextQuestion = async () => {
    if (!isHost) return;

    try {
      const response = await fetch("/api/nextQuestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });

      const data = await response.json();

      if (data.matchCompleted) {
        // End match and save to MongoDB
        await fetch("/api/endMatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });

        router.push(`/match/${matchId}/results`);
      }
    } catch (error) {
      console.error("Error moving to next question:", error);
    }
  };

  if (!user || !match || !currentQuestion) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Match in Progress</h1>
          <p className="text-gray-600">
            Question {match.current_question + 1} of {totalQuestions}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            <span className={timeLeft <= 10 ? "text-red-500" : "text-blue-600"}>
              {timeLeft}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>{scores.length}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Question and Answer */}
        <div className="lg:col-span-2">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-xl">{currentQuestion.text}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitAnswer} className="space-y-4">
                <Input
                  placeholder="Type your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={hasAnswered || timeLeft === 0}
                  className="text-lg"
                />
                <Button
                  type="submit"
                  disabled={
                    !answer.trim() ||
                    hasAnswered ||
                    timeLeft === 0 ||
                    isSubmitting
                  }
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting
                    ? "Submitting..."
                    : hasAnswered
                    ? "Answer Submitted"
                    : "Submit Answer"}
                </Button>
              </form>

              {message && (
                <div
                  className={`mt-4 p-3 rounded-lg ${
                    message.includes("🎉")
                      ? "bg-green-100 text-green-800"
                      : message.includes("✅")
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {message}
                </div>
              )}

              {isHost && hasAnswered && (
                <div className="mt-4">
                  <Button
                    onClick={nextQuestion}
                    className="w-full"
                    variant="outline"
                  >
                    Next Question
                  </Button>
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    You are the host - click to advance to the next question
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scoreboard */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Live Scoreboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scores.map((score, index) => (
                  <div
                    key={score.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      score.user_id === user?.id
                        ? "bg-blue-50 border-2 border-blue-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="font-medium">
                        {score.user_id === user?.id
                          ? "You"
                          : `Player ${index + 1}`}
                      </span>
                      {isHost && score.user_id === user?.id && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          HOST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{score.points}</span>
                      <span className="text-sm text-gray-500">pts</span>
                    </div>
                  </div>
                ))}
                {scores.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No players yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Match Info */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">Match ID</p>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                  {typeof matchId === "string" ? matchId.slice(0, 8) : ""}...
                </p>
                <p className="text-xs text-gray-500">
                  Share this ID with friends to join
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>
            {match.current_question + 1} / {totalQuestions}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${
                ((match.current_question + 1) / totalQuestions) * 100
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
