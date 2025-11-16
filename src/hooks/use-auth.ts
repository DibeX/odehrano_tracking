import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setUser(data);

      // Update last login time (fire and forget)
      supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", userId)
        .then(() => {});
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  async function resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL}/auth/reset-password`,
    });
    return { data, error };
  }

  async function updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });
    return { data, error };
  }

  function hasRole(role: "admin" | "moderator" | "player"): boolean {
    if (!user) return false;
    if (role === "admin") return user.role === "admin";
    if (role === "moderator")
      return user.role === "admin" || user.role === "moderator";
    return true; // Everyone is at least a player
  }

  return {
    user,
    supabaseUser,
    loading,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    hasRole,
    isAdmin: hasRole("admin"),
    isModerator: hasRole("moderator"),
  };
}
