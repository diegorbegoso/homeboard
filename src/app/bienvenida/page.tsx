import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HouseholdForms } from "@/app/(app)/hogares/household-forms";
import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/submit-button";
import { HOUSEHOLD_ERROR_COPY, listHouseholds } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Te damos la bienvenida — HomeBoard" };

export default async function BienvenidaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (await listHouseholds(supabase, user.id)).length > 0) {
    // Server Action redirects render this page without going through proxy.ts, so check here too.
    redirect("/");
  }
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const firstName = profile?.display_name.split(" ")[0];

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1>{firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}</h1>
        <p className="mt-2 text-muted-foreground">Te damos la bienvenida a HomeBoard. Crea tu hogar o únete a uno.</p>
      </div>
      {error && HOUSEHOLD_ERROR_COPY[error] && (
        <p role="alert" className="rounded-input bg-muted px-4 py-3 text-sm text-destructive">
          {HOUSEHOLD_ERROR_COPY[error]}
        </p>
      )}

      <HouseholdForms back="/bienvenida" />

      <form action={signOut} className="text-center">
        <SubmitButton
          pendingLabel="Cerrando sesión…"
          className="mx-auto px-4 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          ¿Cuenta equivocada? Cerrar sesión
        </SubmitButton>
      </form>
    </main>
  );
}
