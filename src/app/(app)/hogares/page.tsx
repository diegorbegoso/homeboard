import { CheckCircle } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { getActiveHousehold, HOUSEHOLD_ERROR_COPY } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { cambiarHogar, salirDeHogar } from "./actions";
import { HouseholdForms } from "./household-forms";
import { LeaveHousehold } from "./leave-household";

export const metadata: Metadata = { title: "Mis hogares — HomeBoard" };

export default async function HogaresPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { active, all } = await getActiveHousehold(supabase, user.id);
  // Server Action redirects skip proxy.ts, so a user who just left their last household is sent on here.
  if (all.length === 0) redirect("/bienvenida");
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("household_id")
    .in(
      "household_id",
      all.map((household) => household.id),
    );
  const memberCount = (id: string) => memberRows?.filter((row) => row.household_id === id).length ?? 0;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8">
      <h1>Mis hogares</h1>
      {error && HOUSEHOLD_ERROR_COPY[error] && (
        <p role="alert" className="rounded-input bg-muted px-4 py-3 text-sm text-destructive">
          {HOUSEHOLD_ERROR_COPY[error]}
        </p>
      )}

      <ul aria-label="Mis hogares" className="flex flex-col gap-3">
        {all.map((household) => {
          const isActive = household.id === active?.id;
          return (
            <li
              key={household.id}
              data-testid="hogar"
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{household.name}</p>
                <p className="text-sm text-muted-foreground">Código {household.inviteCode}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isActive ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-success">
                    <CheckCircle size={20} weight="fill" aria-hidden="true" />
                    Activo
                  </span>
                ) : (
                  <form action={cambiarHogar}>
                    <input type="hidden" name="hogar" value={household.id} />
                    <SubmitButton
                      pendingLabel="Cambiando…"
                      className="rounded-full border border-border px-4 text-sm font-medium"
                    >
                      <span className="sr-only">Usar {household.name}</span>
                      <span aria-hidden="true">Usar</span>
                    </SubmitButton>
                  </form>
                )}
                <LeaveHousehold
                  householdId={household.id}
                  name={household.name}
                  isLastMember={memberCount(household.id) <= 1}
                  leave={salirDeHogar}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <HouseholdForms back="/hogares" />
    </div>
  );
}
