import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";

export async function requireAuth() {
  // Skip auth check during SSR - let client handle it
  if (typeof window === "undefined") {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw redirect({
      to: "/login",
      search: {
        redirect: window.location.pathname,
      },
    });
  }

  return session;
}

export async function requireRole(role: UserRole) {
  const session = await requireAuth();

  // Skip role check during SSR
  if (!session) {
    return null;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", session.user.id)
    .single();

  if (error || !user) {
    throw redirect({ to: "/login" });
  }

  const hasPermission =
    role === "admin"
      ? user.role === "admin"
      : role === "moderator"
        ? ["admin", "moderator"].includes(user.role)
        : true; // Everyone has player access

  if (!hasPermission) {
    throw redirect({ to: "/dashboard" });
  }

  return { session, user };
}
