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
import {
  Trophy,
  Medal,
  Award,
  Home,
  RotateCcw,
  Users,
  Crown,
  Zap,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

// Types
interface FinalScore {
  user_id: string;
  points: number;
  current_streak: number;
  profiles: {
    username: string;
    avatar_url?: string;
  };
}

interface Question {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

interface MatchQuestionRow {
  questions: Question | null;
}

export default function ResultsPage() {
  const params = useParams();
  const matchId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [scores, setScores] = useState<FinalScore[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [podiumAnimated, setPodiumAnimated] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    checkUser();
    fetchResults();
    saveMatchHistory();

    // Animate podium after brief delay
    setTimeout(() => setPodiumAnimated(true), 500);
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
      // Get final scores with profiles
      const { data: scoresData, error: scoresError } = await supabase
        .from("scores")
        .select(
          `
          user_id, 
          points, 
          current_streak,
          profiles (
            username,
            avatar_url
          )
        `
        )
        .eq("match_id", matchId)
        .order("points", { ascending: false });

      if (scoresError) throw scoresError;

      const mappedScores = (scoresData || []).map((score: any) => ({
        user_id: score.user_id,
        points: score.points,
        current_streak: score.current_streak,
        profiles: score.profiles?.[0] || { username: null, avatar_url: null }, // pick first profile
      }));

      setScores(mappedScores);

      // Get match questions for review
      const { data: questionsData, error: questionsError } = await supabase
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

      if (questionsError) throw questionsError;
      setQuestions(
        questionsData?.flatMap((mq: any) => mq.questions || []) || []
      );
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

  const getPodiumIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-8 w-8 text-yellow-500" />;
      case 2:
        return <Medal className="h-8 w-8 text-gray-400" />;
      case 3:
        return <Award className="h-8 w-8 text-amber-600" />;
      default:
        return null;
    }
  };

  const getPodiumHeight = (position: number) => {
    switch (position) {
      case 1:
        return "h-32";
      case 2:
        return "h-24";
      case 3:
        return "h-20";
      default:
        return "h-16";
    }
  };

  const getPodiumColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-t from-yellow-400 to-yellow-300";
      case 2:
        return "bg-gradient-to-t from-gray-400 to-gray-300";
      case 3:
        return "bg-gradient-to-t from-amber-500 to-amber-400";
      default:
        return "bg-gradient-to-t from-blue-400 to-blue-300";
    }
  };

  const getUserRank = () => {
    return scores.findIndex((score) => score.user_id === user?.id) + 1;
  };

  const getUserScore = () => {
    return scores.find((score) => score.user_id === user?.id)?.points || 0;
  };

  const getMaxStreak = () => {
    return Math.max(...scores.map((s) => s.current_streak), 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  const userRank = getUserRank();
  const userScore = getUserScore();
  const totalQuestions = questions.length;
  const topThree = scores.slice(0, 3);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🏆 Match Complete!
        </h1>
        <p className="text-gray-600">Here are the final results</p>
        {saving && (
          <p className="text-sm text-blue-600 mt-2">
            💾 Saving match history...
          </p>
        )}
      </div>

      {/* Podium Section */}
      {topThree.length > 0 && (
        <Card className="mb-8 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🏆 Winners Podium</CardTitle>
            <CardDescription>Top 3 performers of this match</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-end gap-8 mb-8">
              {/* Second Place */}
              {topThree[1] && (
                <div
                  className={`text-center transition-all duration-1000 ${
                    podiumAnimated
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                >
                  <div className="mb-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                      {topThree[1].profiles?.username
                        ?.charAt(0)
                        .toUpperCase() || "?"}
                    </div>
                    <h3 className="font-semibold">
                      {topThree[1].user_id === user?.id
                        ? "You"
                        : topThree[1].profiles?.username}
                    </h3>
                    <p className="text-2xl font-bold text-gray-600">
                      {topThree[1].points}
                    </p>
                    <p className="text-sm text-gray-500">points</p>
                  </div>
                  <div
                    className={`${getPodiumHeight(2)} w-20 ${getPodiumColor(
                      2
                    )} rounded-t-lg flex items-end justify-center pb-2`}
                  >
                    <span className="text-white font-bold text-xl">2</span>
                  </div>
                </div>
              )}

              {/* First Place */}
              <div
                className={`text-center transition-all duration-1000 delay-300 ${
                  podiumAnimated
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
              >
                <div className="mb-3">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2 animate-pulse">
                    {topThree[0].profiles?.username?.charAt(0).toUpperCase() ||
                      "?"}
                  </div>
                  <h3 className="font-semibold text-lg">
                    {topThree[0].user_id === user?.id
                      ? "You"
                      : topThree[0].profiles?.username}
                  </h3>
                  <p className="text-3xl font-bold text-yellow-600">
                    {topThree[0].points}
                  </p>
                  <p className="text-sm text-gray-500">points</p>
                  <Crown className="h-6 w-6 text-yellow-500 mx-auto mt-1" />
                </div>
                <div
                  className={`${getPodiumHeight(1)} w-24 ${getPodiumColor(
                    1
                  )} rounded-t-lg flex items-end justify-center pb-2`}
                >
                  <span className="text-white font-bold text-2xl">1</span>
                </div>
              </div>

              {/* Third Place */}
              {topThree[2] && (
                <div
                  className={`text-center transition-all duration-1000 delay-150 ${
                    podiumAnimated
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                >
                  <div className="mb-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                      {topThree[2].profiles?.username
                        ?.charAt(0)
                        .toUpperCase() || "?"}
                    </div>
                    <h3 className="font-semibold">
                      {topThree[2].user_id === user?.id
                        ? "You"
                        : topThree[2].profiles?.username}
                    </h3>
                    <p className="text-xl font-bold text-amber-600">
                      {topThree[2].points}
                    </p>
                    <p className="text-sm text-gray-500">points</p>
                  </div>
                  <div
                    className={`${getPodiumHeight(3)} w-18 ${getPodiumColor(
                      3
                    )} rounded-t-lg flex items-end justify-center pb-2`}
                  >
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Performance Summary */}
      {user && (
        <Card
          className={`mb-6 ${
            userRank <= 3
              ? "bg-gradient-to-r from-green-50 to-blue-50 border-green-200"
              : "bg-gray-50"
          }`}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {userRank <= 3 ? (
                  getPodiumIcon(userRank)
                ) : (
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Performance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{userRank}</p>
                  <p className="text-sm text-gray-600">Final Rank</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {userScore}
                  </p>
                  <p className="text-sm text-gray-600">Total Points</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.round(
                      (userScore / (totalQuestions * (500 + 30 * 20))) * 100
                    )}
                    %
                  </p>
                  <p className="text-sm text-gray-600">Efficiency</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-orange-600">
                    {scores.find((s) => s.user_id === user?.id)
                      ?.current_streak || 0}
                  </p>
                  <p className="text-sm text-gray-600">Final Streak</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Complete Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Complete Leaderboard
            </CardTitle>
            <CardDescription>
              Final rankings with detailed stats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scores.map((score, index) => (
                <div
                  key={score.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    score.user_id === user?.id
                      ? "bg-blue-50 border-blue-200 shadow-md"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      {index < 3 ? (
                        getPodiumIcon(index + 1)
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                      )}
                    </div>

                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {score.profiles?.username?.charAt(0).toUpperCase() || "?"}
                    </div>

                    <div>
                      <p className="font-semibold text-lg">
                        {score.user_id === user?.id
                          ? "You"
                          : score.profiles?.username || "Unknown Player"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Zap className="h-3 w-3" />
                        <span>
                          {Math.round(
                            (score.points /
                              (totalQuestions * (500 + 30 * 20))) *
                              100
                          )}
                          % efficiency
                        </span>
                        {score.current_streak > 1 && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600">
                              🔥 {score.current_streak} streak
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-800">
                      {score.points}
                    </p>
                    <p className="text-sm text-gray-600">points</p>
                  </div>
                </div>
              ))}
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
              {questions.map((question, index) => {
                const correctOptionKey = question.correct_answer;

                return (
                  <div key={question.id} className="border rounded-lg p-4">
                    <p className="font-medium mb-3">
                      <span className="text-blue-600">Q{index + 1}:</span>{" "}
                      {question.text}
                    </p>
                    <div className="grid grid-cols-1 gap-2 mb-2 text-sm">
                      <div
                        className={`p-2 rounded ${
                          correctOptionKey === "A"
                            ? "bg-green-100 text-green-800 animate-pulse"
                            : "bg-gray-50"
                        }`}
                      >
                        🅰️ {question.option_a}
                      </div>
                      <div
                        className={`p-2 rounded ${
                          correctOptionKey === "B"
                            ? "bg-green-100 text-green-800 animate-pulse"
                            : "bg-gray-50"
                        }`}
                      >
                        🅱️ {question.option_b}
                      </div>
                      <div
                        className={`p-2 rounded ${
                          correctOptionKey === "C"
                            ? "bg-green-100 text-green-800 animate-pulse"
                            : "bg-gray-50"
                        }`}
                      >
                        🅲 {question.option_c}
                      </div>
                      <div
                        className={`p-2 rounded ${
                          correctOptionKey === "D"
                            ? "bg-green-100 text-green-800 animate-pulse"
                            : "bg-gray-50"
                        }`}
                      >
                        🅳 {question.option_d}
                      </div>
                    </div>
                    <p className="text-sm text-green-600 font-medium">
                      ✓ Correct Answer: {correctOptionKey}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          onClick={() => router.push("/lobby")}
          className="flex items-center gap-2"
          size="lg"
        >
          <Home className="h-4 w-4" />
          Back to Lobby
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="flex items-center gap-2"
          size="lg"
        >
          <RotateCcw className="h-4 w-4" />
          Play Again
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/history")}
          className="flex items-center gap-2"
          size="lg"
        >
          View History
        </Button>
      </div>

      {/* Match Statistics */}
      <Card className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle>📊 Match Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
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
            <div>
              <p className="text-2xl font-bold text-red-600">
                {getMaxStreak()}
              </p>
              <p className="text-sm text-gray-600">Max Streak</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
