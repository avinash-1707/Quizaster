"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { Users, Crown, Play, Clock, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Player {
  user_id: string;
  username: string;
  avatar_url?: string;
  joined_at: string;
}

interface Match {
  id: string;
  host_id: string;
  status: string;
  created_at: string;
}

export default function PreGameLobbyPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;

    checkUser();
    fetchMatchData();

    // Set up real-time subscriptions
    const matchChannel = supabase
      .channel(`match_lobby_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          //@ts-ignore
          if (payload.new && payload.new.status === "in_progress") {
            router.push(`/match/${matchId}`);
          }
        }
      )
      .subscribe();

    const scoresChannel = supabase
      .channel(`lobby_players_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `match_id=eq.${matchId}`,
        },
        () => fetchPlayers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(scoresChannel);
    };
  }, [matchId, router]);

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

  useEffect(() => {
    if (user && matchId) {
      fetchMatchData();
    }
  }, [user, matchId]);

  const fetchMatchData = async () => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("id, host_id, status, created_at")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;

      if (matchData.status === "in_progress") {
        router.push(`/match/${matchId}`);
        return;
      }

      if (matchData.status === "finished") {
        router.push(`/match/${matchId}/results`);
        return;
      }

      setMatch(matchData);
      setIsHost(matchData.host_id === user?.id);

      await fetchPlayers();
    } catch (error) {
      console.error("Error fetching match data:", error);
      router.push("/lobby");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data: playersData, error: playersError } = await supabase
        .from("scores")
        .select(
          `
          user_id,
          created_at,
          profiles (
            username,
            avatar_url
          )
        `
        )
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (playersError) throw playersError;

      console.log(playersData);

      const formattedPlayers =
        playersData?.map((player) => ({
          user_id: player.user_id,
          username: player.profiles?.[0]?.username || "Unknown Player",
          avatar_url: player.profiles?.[0]?.avatar_url || null,
          joined_at: player.created_at,
        })) || [];

      setPlayers(formattedPlayers);
    } catch (error) {
      console.error("Error fetching players:", error);
    }
  };

  const startGame = async () => {
    if (!isHost || !match) return;

    setIsStarting(true);

    try {
      const { error } = await supabase
        .from("matches")
        .update({ status: "in_progress" })
        .eq("id", matchId);

      if (error) throw error;

      // Will automatically redirect via realtime subscription
    } catch (error) {
      console.error("Error starting game:", error);
      setIsStarting(false);
    }
  };

  const copyMatchId = async () => {
    try {
      await navigator.clipboard.writeText(matchId as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy match ID");
    }
  };

  const leaveMatch = async () => {
    if (!user) return;

    try {
      await supabase
        .from("scores")
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", user.id);

      router.push("/lobby");
    } catch (error) {
      console.error("Error leaving match:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (!match || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Match not found or access denied</p>
          <Button onClick={() => router.push("/lobby")}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Game Lobby</h1>
        <p className="text-gray-600">Waiting for players to join...</p>

        {/* Match ID Display */}
        <div className="mt-4 flex justify-center">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Match ID:</span>
                <code className="bg-white px-2 py-1 rounded font-mono text-sm">
                  {typeof matchId === "string" ? matchId.slice(0, 8) : ""}...
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyMatchId}
                  className="h-8 px-2"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Share this ID with friends to join
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Players List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players ({players.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {players.map((player, index) => (
                <div
                  key={player.user_id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    player.user_id === user.id
                      ? "bg-blue-50 border-2 border-blue-200"
                      : "bg-gray-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {player.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {player.user_id === user.id ? "You" : player.username}
                      </span>
                      {match.host_id === player.user_id && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Joined {new Date(player.joined_at).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Join Order */}
                  <div className="text-sm text-gray-400">#{index + 1}</div>
                </div>
              ))}

              {players.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No players yet</p>
                  <p className="text-sm">
                    Share the match ID to invite players!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Game Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Info */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Questions:</span>
                <span className="font-medium">5 per match</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Time per question:
                </span>
                <span className="font-medium">30 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Answer reveal:</span>
                <span className="font-medium">5 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Scoring:</span>
                <span className="font-medium">Speed-based</span>
              </div>
            </div>

            {/* Host Controls */}
            {isHost ? (
              <div className="space-y-3">
                <Button
                  onClick={startGame}
                  disabled={players.length < 1 || isStarting}
                  className="w-full"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isStarting ? "Starting Game..." : "Start Game"}
                </Button>

                {players.length < 1 && (
                  <p className="text-sm text-gray-500 text-center">
                    Need at least 1 player to start
                  </p>
                )}

                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">You are the host</p>
                  <Button
                    variant="outline"
                    onClick={leaveMatch}
                    className="w-full"
                  >
                    Cancel Match
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4 animate-pulse" />
                  <span>Waiting for host to start the game...</span>
                </div>

                <Button
                  variant="outline"
                  onClick={leaveMatch}
                  className="w-full"
                >
                  Leave Match
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ready Status */}
      <Card className="mt-6 bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  players.length >= 1
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-300"
                }`}
              />
            </div>
            <p className="font-medium">
              {players.length >= 1
                ? "Ready to start!"
                : "Waiting for players..."}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {isHost
                ? 'Click "Start Game" when ready'
                : "Host will start the game when ready"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
