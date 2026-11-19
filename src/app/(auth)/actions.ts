"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  correo: z.email(),
  contrasena: z.string().min(1),
});

const signUpSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  correo: z.email(),
  contrasena: z.string(),
});

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
  });
  if (!parsed.success) {
    redirect("/entrar?error=datos_invalidos");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.contrasena,
  });
  if (error) {
    redirect("/entrar?error=credenciales_invalidas");
  }
  redirect("/");
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    nombre: formData.get("nombre"),
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
  });
  if (!parsed.success) {
    redirect("/registro?error=datos_invalidos");
  }
  const { nombre, correo, contrasena } = parsed.data;
  if (contrasena.length < 8) {
    redirect("/registro?error=contrasena_corta");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { full_name: nombre } },
  });
  if (error) {
    if (error.code === "user_already_exists") {
      redirect("/registro?error=correo_en_uso");
    }
    redirect("/registro?error=datos_invalidos");
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin") ?? getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) {
    redirect("/entrar?error=oauth");
  }
  redirect(data.url);
}
