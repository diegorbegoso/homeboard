import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes — HomeBoard" };

export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, user_id, households(name, invite_code)")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: memberRows } = membership
    ? await supabase.from("household_members").select("user_id").eq("household_id", membership.household_id)
    : { data: null };

  const memberIds = memberRows?.map((m) => m.user_id) ?? [];
  const { data: profileRows } =
    memberIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
      : { data: null };

  const profileMap = Object.fromEntries(profileRows?.map((p) => [p.id, p.display_name]) ?? []);
  const household = membership?.households as { name: string; invite_code: string } | null;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8">
      <h1>Ajustes</h1>

      {household && (
        <div className="rounded-card border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-heading font-extrabold">Tu hogar</h2>
          <p className="mb-2 font-medium">{household.name}</p>
          <p
            data-testid="codigo-invitacion"
            className="font-heading text-2xl font-extrabold tracking-widest text-primary"
          >
            {household.invite_code}
          </p>
        </div>
      )}

      {memberRows && memberRows.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-heading font-extrabold">Miembros</h2>
          <ul aria-label="Miembros" className="flex flex-col gap-2">
            {memberRows.map((m) => {
              const isMe = m.user_id === user.id;
              return (
                <li key={m.user_id} className="text-sm">
                  {profileMap[m.user_id] ?? "—"}
                  {isMe && <span className="ml-1 text-muted-foreground">(tú)</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-card border border-border bg-surface p-6">
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-full border border-destructive py-3 text-sm font-medium text-destructive"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
