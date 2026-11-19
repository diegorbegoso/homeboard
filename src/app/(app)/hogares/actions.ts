"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HOUSEHOLD_ERROR_COPY, listHouseholds } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

// Where to send the user back to when something fails: onboarding page or the households page.
const backSchema = z.enum(["/bienvenida", "/hogares"]).catch("/bienvenida");

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return { supabase, user };
}

function fail(back: string, message: string): never {
  const code = HOUSEHOLD_ERROR_COPY[message] ? message : "error_inesperado";
  redirect(`${back}?error=${code}`);
}

export async function crearHogar(formData: FormData): Promise<void> {
  const back = backSchema.parse(field(formData, "volver"));
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_household", { p_name: field(formData, "nombre") });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function unirseAHogar(formData: FormData): Promise<void> {
  const back = backSchema.parse(field(formData, "volver"));
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("join_household", { p_code: field(formData, "codigo").toUpperCase() });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function cambiarHogar(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(field(formData, "hogar"));
  if (!parsed.success) redirect("/hogares?error=error_inesperado");
  const { supabase, user } = await requireUser();
  const households = await listHouseholds(supabase, user.id);
  if (!households.some((household) => household.id === parsed.data)) redirect("/hogares?error=error_inesperado");
  const { error } = await supabase.from("profiles").update({ active_household_id: parsed.data }).eq("id", user.id);
  if (error) redirect("/hogares?error=error_inesperado");
  revalidatePath("/", "layout");
  redirect("/");
}
