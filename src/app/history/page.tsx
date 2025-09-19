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
import { useRouter } from "next/navigation";
import {
  History,
  Trophy,
  Users,
  Calendar,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface GameHistory {
  _id: string;
  matchId: string;
  questions: {
    id: string;
    text: string;
    correct_answer: string;
  }[];
  scores: {
    userId: string;
    points: number;
  }[];
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [histories, setHistories] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<GameHistory | null>(
    null
  );

  useEffect(() => {
    checkUser();
    fetchHistory();
  }, []);

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

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/history?limit=20");
      const data = await response.json();

      if (response.ok) {
        setHistories(data.histories || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getUserRank = (scores: GameHistory["scores"], userId: string) => {
    const sortedScores = [...scores].sort((a, b) => b.points - a.points);
    return sortedScores.findIndex((score) => score.userId === userId) + 1;
  };

  const getUserScore = (scores: GameHistory["scores"], userId: string) => {
    return scores.find((score) => score.userId === userId)?.points || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading history...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push("/lobby")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Lobby
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Match History</h1>
          <p className="text-gray-600">Review your past game performances</p>
        </div>
      </div>

      {selectedHistory ? (
        /* Detailed View */
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedHistory(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Button>
            <div>
              <h2 className="text-2xl font-bold">Match Details</h2>
              <p className="text-gray-600">
                {formatDate(selectedHistory.createdAt).date} at{" "}
                {formatDate(selectedHistory.createdAt).time}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Final Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Final Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedHistory.scores
                    .sort((a, b) => b.points - a.points)
                    .map((score, index) => (
                      <div
                        key={score.userId}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          score.userId === user?.id
                            ? "bg-blue-50 border-2 border-blue-200"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 flex items-center justify-center bg-gray-200 rounded-full text-sm font-bold">
                            {index + 1}
                          </div>
                          <span className="font-medium">
                            {score.userId === user?.id
                              ? "You"
                              : `Player ${index + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">
                            {score.points}
                          </span>
                          <span className="text-sm text-gray-500">pts</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Questions Review */}
            <Card>
              <CardHeader>
                <CardTitle>Questions & Answers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedHistory.questions.map((question, index) => (
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Match Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Match Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedHistory.scores.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Players</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {selectedHistory.questions.length}
                  </p>
                  <p className="text-sm text-gray-600">Questions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {user ? getUserRank(selectedHistory.scores, user.id) : "-"}
                  </p>
                  <p className="text-sm text-gray-600">Your Rank</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {user ? getUserScore(selectedHistory.scores, user.id) : "-"}
                  </p>
                  <p className="text-sm text-gray-600">Your Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* History List */
        <div className="space-y-4">
          {histories.length > 0 ? (
            histories.map((history) => {
              const { date, time } = formatDate(history.createdAt);
              const userRank = user
                ? getUserRank(history.scores, user.id)
                : null;
              const userScore = user
                ? getUserScore(history.scores, user.id)
                : 0;
              const maxScore = Math.max(...history.scores.map((s) => s.points));

              return (
                <Card
                  key={history._id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedHistory(history)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-100 rounded-lg">
                          <Calendar className="h-6 w-6 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">
                            {date.split("/")[1]}/{date.split("/")[0]}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">
                            Match #{history.matchId.slice(0, 8)}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {time}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {history.scores.length} players
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4" />
                              {history.questions.length} questions
                            </div>
                          </div>
                        </div>
                      </div>

                      {user && userRank && (
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-gray-600">
                              Your rank:
                            </span>
                            <span
                              className={`font-bold text-lg ${
                                userRank === 1
                                  ? "text-yellow-600"
                                  : userRank === 2
                                  ? "text-gray-500"
                                  : userRank === 3
                                  ? "text-amber-600"
                                  : "text-gray-700"
                              }`}
                            >
                              #{userRank}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              Score:
                            </span>
                            <span className="font-bold text-lg text-blue-600">
                              {userScore}/{history.questions.length}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-gray-500">
                  <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No Match History</h3>
                  <p className="text-sm">
                    Play some games to see your match history here!
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => router.push("/lobby")}
                  >
                    Start Playing
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
