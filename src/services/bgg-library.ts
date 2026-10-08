import { supabase } from "@/lib/supabase";
import { BGGError } from "./bgg-contract";

export async function findExistingBGGGame(
  id: number,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from("board_games")
    .select("id, name")
    .eq("bgg_id", id)
    .maybeSingle();
  if (error) throw new BGGError("UNAVAILABLE");
  return data;
}
