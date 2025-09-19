"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { Trophy, Medal, Award, Home, RotateCcw, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FinalScore {
  user_id: string;
  points: number;
}

interface Question {
  id: string;
  text: string;
  correct_answer: string;
}

export default function ResultsPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [scores, setScores] = useState<FinalScore[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    checkUser();
    fetchResults();
    saveMatchHistory();
  }, [matchId]);

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

  const fetchResults = async () => {
    try {
      // Get final scores
      const { data: scoresData, error: scoresError } = await supabase
        .from("scores")
        .select("user_id, points")
        .eq("match_id", matchId)
        .order("points", { ascending: false });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);

      // Get match questions for review
      const { data: questionsData, error: questionsError } = await supabase
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

      if (questionsError) throw questionsError;
      setQuestions(questionsData?.map((mq) => mq.questions) || []);
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveMatchHistory = async () => {
    setSaving(true);
    try {
      await fetch("/api/endMatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
    } catch (error) {
      console.error("Error saving match history:", error);
    } finally {
      setSaving(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return (
          <div className="h-6 w-6 flex items-center justify-center bg-gray-200 rounded-full text-sm font-bold">
            {index + 1}
          </div>
        );
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200";
      case 1:
        return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200";
      case 2:
        return "bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getUserRank = () => {
    return scores.findIndex((score) => score.user_id === user?.id) + 1;
  };

  const getUserScore = () => {
    return scores.find((score) => score.user_id === user?.id)?.points || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading results...
      </div>
    );
  }

  const userRank = getUserRank();
  const userScore = getUserScore();
  const totalQuestions = questions.length;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Match Complete!
        </h1>
        <p className="text-gray-600">Here are the final results</p>
        {saving && (
          <p className="text-sm text-blue-600 mt-2">Saving match history...</p>
        )}
      </div>

      {/* User Performance Summary */}
      {user && (
        <Card className={`mb-6 ${getRankColor(userRank - 1)}`}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {getRankIcon(userRank - 1)}
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Performance</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{userRank}</p>
                  <p className="text-sm text-gray-600">Rank</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {userScore}
                  </p>
                  <p className="text-sm text-gray-600">Points</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.round((userScore / totalQuestions) * 100)}%
                  </p>
                  <p className="text-sm text-gray-600">Accuracy</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Final Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Final Leaderboard
            </CardTitle>
            <CardDescription>Final rankings for all players</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scores.map((score, index) => (
                <div
                  key={score.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${getRankColor(
                    index
                  )}`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(index)}
                    <div>
                      <p className="font-semibold">
                        {score.user_id === user?.id
                          ? "You"
                          : `Player ${index + 1}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {Math.round((score.points / totalQuestions) * 100)}%
                        correct
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{score.points}</p>
                    <p className="text-sm text-gray-600">points</p>
                  </div>
                </div>
              ))}
              {scores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No scores recorded</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
            <CardDescription>
              Review all questions and correct answers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {questions.map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4">
                  <p className="font-medium mb-2">
                    <span className="text-blue-600">Q{index + 1}:</span>{" "}
                    {question.text}
                  </p>
                  <p className="text-sm text-green-600">
                    <span className="font-medium">Answer:</span>{" "}
                    {question.correct_answer}
                  </p>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No questions to review</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          onClick={() => router.push("/lobby")}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Back to Lobby
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Play Again
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/history")}
          className="flex items-center gap-2"
        >
          View History
        </Button>
      </div>

      {/* Match Stats */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {scores.length}
              </p>
              <p className="text-sm text-gray-600">Players</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {totalQuestions}
              </p>
              <p className="text-sm text-gray-600">Questions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {scores.length > 0
                  ? Math.round(
                      scores.reduce((sum, s) => sum + s.points, 0) /
                        scores.length
                    )
                  : 0}
              </p>
              <p className="text-sm text-gray-600">Avg Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {scores.length > 0
                  ? Math.max(...scores.map((s) => s.points))
                  : 0}
              </p>
              <p className="text-sm text-gray-600">High Score</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
