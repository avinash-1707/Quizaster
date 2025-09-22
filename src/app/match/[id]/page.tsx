"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { Trophy, Users, Clock, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Question {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

interface Score {
  user_id: string;
  points: number;
  current_streak: number;
  profiles: {
    username: string | null;
    avatar_url?: string | null;
  } | null;
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
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number>(0);

  // Audio setup
  const playSound = (type: "tick" | "correct" | "incorrect" | "timeup") => {
    // Create audio context for sound effects
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    const frequencies = {
      tick: 800,
      correct: 523.25, // C5
      incorrect: 220, // A3
      timeup: 196, // G3
    };

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequencies[type];
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const resetQuestionState = useCallback(() => {
    setSelectedAnswer("");
    setHasAnswered(false);
    setMessage("");
    setShowCorrectAnswer(false);
    setCorrectAnswer("");
    setTimeLeft(30);
    setAutoAdvanceTimer(null);
    setAutoAdvanceCountdown(0);
  }, []);

  useEffect(() => {
    if (!matchId) return;

    let sessionUserId: string = "";

    const initializeMatch = async () => {
      const sessionUser = await checkUser();
      if (sessionUser) {
        // Pass the user to fetchMatchData
        fetchMatchData(sessionUser.id);
        sessionUserId = sessionUser.id;
      }
    };

    initializeMatch();

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
          fetchMatchData(sessionUserId);
          resetQuestionState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [matchId, resetQuestionState]);

  // Timer effect with proper cleanup
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (timeLeft > 0 && currentQuestion && !hasAnswered && !showCorrectAnswer) {
      timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !hasAnswered && !showCorrectAnswer) {
      // Time's up - show correct answer
      setShowCorrectAnswer(true);
      setMessage("⏰ Time's up!");

      // Auto-advance after 5 seconds if host (instead of 3)
      if (isHost) {
        const autoTimer = window.setTimeout(() => {
          nextQuestion();
        }, 5000);
        setAutoAdvanceTimer(autoTimer);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timeLeft, currentQuestion, hasAnswered, showCorrectAnswer, isHost]);

  // Auto-advance effect after answer is submitted (5 seconds)
  useEffect(() => {
    if (showCorrectAnswer && hasAnswered && isHost && !autoAdvanceTimer) {
      setAutoAdvanceCountdown(5);
      const autoTimer = window.setTimeout(() => {
        nextQuestion();
      }, 5000); // 5 second delay to show the result
      setAutoAdvanceTimer(autoTimer);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setAutoAdvanceCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(countdownInterval);
      };
    }

    return () => {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
      }
    };
  }, [showCorrectAnswer, hasAnswered, isHost, autoAdvanceTimer]);

  // Cleanup auto-advance timer on component unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
      }
    };
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
    return session.user;
  };

  const fetchMatchData = async (userId: string) => {
    try {
      // Get match details
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("id, current_question, host_id")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);

      setIsHost(matchData.host_id === userId);

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
            option_a,
            option_b,
            option_c,
            option_d,
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
        //@ts-ignore
        setCurrentQuestion(questionData.questions as Question);
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

      // Map profiles array to single object
      const mappedScores = (scoresData || []).map((score: any) => ({
        user_id: score.user_id,
        points: score.points,
        current_streak: score.current_streak,
        profiles: score.profiles?.[0] || { username: null, avatar_url: null }, // pick first profile
      }));

      setScores(mappedScores);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!currentQuestion || !user || hasAnswered || showCorrectAnswer) return;

    setSelectedAnswer(answer);
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
          answer: answer,
          timeLeft: timeLeft, // Pass remaining time for speed scoring
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasAnswered(true);
        setShowCorrectAnswer(true);
        setCorrectAnswer(data.correctAnswer);

        // Play sound effects
        try {
          if (data.correct) {
            playSound("correct");
            if (data.first) {
              setMessage(
                `🎉 Correct! +${data.pointsAwarded} points! ${
                  data.streakBonus
                    ? `🔥 Streak bonus: +${data.streakBonus}`
                    : ""
                }`
              );
            } else {
              setMessage("✅ Correct, but someone else got there first!");
            }
          } else {
            playSound("incorrect");
            setMessage(
              `❌ Incorrect. The correct answer was ${data.correctAnswer}: ${data.correctAnswerText}`
            );
          }
        } catch (e) {
          console.log("Audio not supported");
          // Fallback to messages without audio
          if (data.correct) {
            if (data.first) {
              setMessage(
                `🎉 Correct! +${data.pointsAwarded} points! ${
                  data.streakBonus
                    ? `🔥 Streak bonus: +${data.streakBonus}`
                    : ""
                }`
              );
            } else {
              setMessage("✅ Correct, but someone else got there first!");
            }
          } else {
            setMessage(
              `❌ Incorrect. The correct answer was ${data.correctAnswer}: ${data.correctAnswerText}`
            );
          }
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

  const getAnswerCardStyle = (optionKey: string) => {
    if (!showCorrectAnswer && !hasAnswered) {
      return "hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md";
    }

    if (correctAnswer === optionKey) {
      return "bg-green-100 border-green-500 text-green-800 animate-pulse shadow-lg transform scale-105";
    }

    if (selectedAnswer === optionKey && selectedAnswer !== correctAnswer) {
      return "bg-red-100 border-red-500 text-red-800 animate-shake";
    }

    return "bg-gray-100 border-gray-300 text-gray-600 opacity-75";
  };

  const getAnswerPrefix = (optionKey: string) => {
    const prefixes = { A: "🅰️", B: "🅱️", C: "🅲", D: "🅳" };
    return prefixes[optionKey as keyof typeof prefixes] || optionKey;
  };

  if (!user || !match || !currentQuestion) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading match...</p>
        </div>
      </div>
    );
  }

  const options = [
    { key: "A", text: currentQuestion.option_a },
    { key: "B", text: currentQuestion.option_b },
    { key: "C", text: currentQuestion.option_c },
    { key: "D", text: currentQuestion.option_d },
  ];

  return (
    <div className="container mx-auto p-4 max-w-6xl">
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
            <Clock
              className={`h-5 w-5 ${
                timeLeft <= 10 ? "animate-pulse text-red-500" : ""
              }`}
            />
            <span
              className={`${
                timeLeft <= 10 ? "timer-warning animate-pulse" : "text-blue-600"
              } min-w-[3rem] font-bold`}
            >
              {timeLeft}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>{scores.length}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Question and Answer Options */}
        <div className="lg:col-span-3">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl leading-relaxed">
                {currentQuestion.text}
              </CardTitle>
              {message && (
                <div
                  className={`mt-4 p-3 rounded-lg font-medium ${
                    message.includes("🎉")
                      ? "bg-green-100 text-green-800 border border-green-300"
                      : message.includes("✅")
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : message.includes("⏰")
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                      : "bg-red-100 text-red-800 border border-red-300"
                  }`}
                >
                  {message}
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Answer Options */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {options.map((option) => (
              <Card
                key={option.key}
                className={`answer-card ${getAnswerCardStyle(
                  option.key
                )} border-2 ${
                  !showCorrectAnswer && !hasAnswered && !isSubmitting
                    ? "hover:shadow-md cursor-pointer"
                    : ""
                } ${
                  correctAnswer === option.key && showCorrectAnswer
                    ? "animate-pulse-glow"
                    : ""
                }`}
                onClick={() => {
                  if (!showCorrectAnswer && !hasAnswered && !isSubmitting) {
                    submitAnswer(option.key);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getAnswerPrefix(option.key)}
                    </span>
                    <span className="font-medium text-lg">{option.text}</span>
                    {correctAnswer === option.key && showCorrectAnswer && (
                      <span className="ml-auto text-green-600 font-bold animate-bounce-in">
                        ✓
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isSubmitting && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>Submitting answer...</span>
              </div>
            </div>
          )}

          {isHost && (showCorrectAnswer || timeLeft === 0) && (
            <div className="text-center">
              <div className="mb-4">
                {autoAdvanceTimer && autoAdvanceCountdown > 0 && (
                  <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">
                      Auto-advancing in {autoAdvanceCountdown} seconds...
                    </span>
                  </div>
                )}
                <Button
                  onClick={() => {
                    if (autoAdvanceTimer) {
                      clearTimeout(autoAdvanceTimer);
                      setAutoAdvanceTimer(null);
                    }
                    nextQuestion();
                  }}
                  size="lg"
                  className="w-full md:w-auto"
                >
                  Next Question →
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                You are the host - question will advance automatically or click
                to continue immediately
              </p>
            </div>
          )}

          {!isHost && (showCorrectAnswer || timeLeft === 0) && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  Waiting for host to advance to next question...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
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
                    <div className="flex items-center gap-3">
                      {index === 0 && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}

                      {/* Avatar */}
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {score.profiles?.username?.charAt(0).toUpperCase() ||
                          "?"}
                      </div>

                      <div>
                        <span className="font-medium">
                          {score.user_id === user?.id
                            ? "You"
                            : score.profiles?.username || "Unknown"}
                        </span>
                        {score.current_streak > 1 && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                              🔥 {score.current_streak} streak
                            </span>
                          </div>
                        )}
                      </div>

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
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
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
