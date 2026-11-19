import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const HOUSEHOLD_ERROR_COPY: Record<string, string> = {
  codigo_invalido: "Ese código no existe",
  hogar_lleno: "Este hogar está lleno",
  nombre_invalido: "El nombre del hogar no es válido",
  no_es_miembro: "Ya no perteneces a ese hogar",
  error_inesperado: "Ocurrió un error inesperado. Intenta de nuevo.",
};

export type HouseholdSummary = { id: string; name: string; inviteCode: string; role: "owner" | "member" };

/** Every household the user belongs to, oldest membership first. RLS already limits rows to the user's own. */
export async function listHouseholds(supabase: Client, userId: string): Promise<HouseholdSummary[]> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id, role, households(name, invite_code)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  return (data ?? []).flatMap((row) => {
    const household = row.households as { name: string; invite_code: string } | null;
    if (!household) return [];
    return [
      {
        id: row.household_id,
        name: household.name,
        inviteCode: household.invite_code,
        role: row.role === "owner" ? ("owner" as const) : ("member" as const),
      },
    ];
  });
}

/**
 * The household the user is working in: `profiles.active_household_id` when they still belong to it,
 * otherwise their oldest membership. The stored id is never trusted without checking membership.
 */
export async function getActiveHousehold(
  supabase: Client,
  userId: string,
): Promise<{ active: HouseholdSummary | null; all: HouseholdSummary[] }> {
  const all = await listHouseholds(supabase, userId);
  if (all.length === 0) return { active: null, all };
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_household_id")
    .eq("id", userId)
    .maybeSingle();
  const active = all.find((household) => household.id === profile?.active_household_id) ?? all[0] ?? null;
  return { active, all };
}
