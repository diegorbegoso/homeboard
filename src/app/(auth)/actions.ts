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
    redirect(
      `/entrar?error=${error.code === "email_not_confirmed" ? "correo_sin_confirmar" : "credenciales_invalidas"}`,
    );
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
  const { data, error } = await supabase.auth.signUp({
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
  // With "Confirm email" on, there is no session until the user opens the link we emailed them.
  if (!data.session) {
    redirect("/entrar?aviso=confirma_tu_correo");
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { error } = await supabase.rpc("delete_account");
  if (error) redirect("/ajustes?error=eliminar_cuenta");
  // The user no longer exists server-side: only clear the local cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/entrar?aviso=cuenta_eliminada");
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin") ?? getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      // Always show Google's account chooser instead of silently reusing the browser's signed-in account.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    redirect("/entrar?error=oauth");
  }
  redirect(data.url);
}
