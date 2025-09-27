"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(""); // optional
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current logged in user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) router.push("/login");
      else setUserId(session.user.id);
    };
    fetchUser();
  }, [router, supabase]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("profiles").insert([
        {
          user_id: userId,
          username,
          avatar_url: avatar || null,
        },
      ]);
      if (error) throw error;
      router.push("/lobby"); // profile created, go to lobby
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleCreateProfile}
        className="w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-bold">Create Your Profile</h1>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          placeholder="Avatar URL (optional)"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create Profile"}
        </Button>
      </form>
    </div>
  );
}
