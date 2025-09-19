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
import { useRouter } from "next/navigation";
import { Plus, Users, Clock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Match {
  id: string;
  created_at: string;
  current_question: number;
  player_count: number;
}

export default function LobbyPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [joinMatchId, setJoinMatchId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
    fetchMatches();

    // Set up real-time updates for matches
    const channel = supabase
      .channel("lobby")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => fetchMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  };

  const fetchMatches = async () => {
    try {
      // Get matches with player counts
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(
          `
          id,
          created_at,
          current_question,
          scores (count)
        `
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (matchesError) throw matchesError;

      const formattedMatches =
        matchesData?.map((match) => ({
          id: match.id,
          created_at: match.created_at,
          current_question: match.current_question,
          player_count: match.scores?.[0]?.count || 0,
        })) || [];

      setMatches(formattedMatches);
    } catch (error) {
      console.error("Error fetching matches:", error);
    }
  };

  const createMatch = async () => {
    if (!user) return;

    setIsCreating(true);
    setMessage("");

    try {
      const response = await fetch("/api/createMatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/match/${data.matchId}`);
      } else {
        setMessage(data.error || "Failed to create match");
      }
    } catch (error) {
      setMessage("Error creating match");
    } finally {
      setIsCreating(false);
    }
  };

  const joinMatch = async (matchId: string) => {
    if (!user) return;

    setIsJoining(true);
    setMessage("");

    try {
      const response = await fetch("/api/joinMatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, userId: user.id }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/match/${matchId}`);
      } else {
        setMessage(data.error || "Failed to join match");
      }
    } catch (error) {
      setMessage("Error joining match");
    } finally {
      setIsJoining(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user)
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Game Lobby</h1>
          <p className="text-gray-600">Welcome, {user.email}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create/Join Match */}
        <Card>
          <CardHeader>
            <CardTitle>Start Playing</CardTitle>
            <CardDescription>
              Create a new match or join with an ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={createMatch}
              className="w-full"
              disabled={isCreating}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "Creating..." : "Create New Match"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Enter Match ID"
                value={joinMatchId}
                onChange={(e) => setJoinMatchId(e.target.value)}
              />
              <Button
                onClick={() => joinMatch(joinMatchId)}
                disabled={!joinMatchId || isJoining}
              >
                {isJoining ? "Joining..." : "Join"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Matches */}
        <Card>
          <CardHeader>
            <CardTitle>Active Matches</CardTitle>
            <CardDescription>Join an ongoing match</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {matches.length > 0 ? (
                matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span>{match.player_count} players</span>
                        <Clock className="h-4 w-4 ml-2" />
                        <span>Q{match.current_question + 1}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {match.id.slice(0, 8)}... •{" "}
                        {new Date(match.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => joinMatch(match.id)}
                      disabled={isJoining}
                    >
                      Join
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No active matches</p>
                  <p className="text-sm">Create one to get started!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push("/history")}>
              View Match History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
