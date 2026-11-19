import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bienvenida a HomeBoard" };

const ERROR_COPY: Record<string, string> = {
  codigo_invalido: "Ese código no existe",
  ya_tiene_hogar: "Ya perteneces a un hogar",
  hogar_lleno: "Este hogar está lleno",
  nombre_invalido: "El nombre del hogar no es válido",
  error_inesperado: "Ocurrió un error inesperado. Intenta de nuevo.",
};

async function crearHogar(formData: FormData) {
  "use server";
  const nombre = (formData.get("nombre") as string | null)?.trim() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase.rpc("create_household", { p_name: nombre });
  if (error) {
    const code = ERROR_COPY[error.message] ? error.message : "error_inesperado";
    redirect(`/bienvenida?error=${code}`);
  }
  redirect("/");
}

async function unirseAHogar(formData: FormData) {
  "use server";
  const codigo = (formData.get("codigo") as string | null)?.trim().toUpperCase() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase.rpc("join_household", { p_code: codigo });
  if (error) {
    const code = ERROR_COPY[error.message] ? error.message : "error_inesperado";
    redirect(`/bienvenida?error=${code}`);
  }
  redirect("/");
}

export default async function BienvenidaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center">Bienvenida a HomeBoard</h1>
      {error && ERROR_COPY[error] && (
        <p role="alert" className="rounded-input bg-muted px-4 py-3 text-sm text-destructive">
          {ERROR_COPY[error]}
        </p>
      )}

      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-heading font-extrabold">Crea tu hogar</h2>
        <form action={crearHogar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nombre-hogar" className="text-sm font-medium">
              Nombre del hogar
            </label>
            <input
              id="nombre-hogar"
              name="nombre"
              type="text"
              required
              className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <button type="submit" className="rounded-full bg-primary py-3 text-sm font-medium text-on-primary">
            Crear hogar
          </button>
        </form>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-heading font-extrabold">Únete con un código</h2>
        <form action={unirseAHogar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="codigo-invitacion" className="text-sm font-medium">
              Código de invitación
            </label>
            <input
              id="codigo-invitacion"
              name="codigo"
              type="text"
              autoCapitalize="characters"
              required
              className="rounded-input border border-border bg-muted px-4 py-3 text-sm uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <button type="submit" className="rounded-full bg-primary py-3 text-sm font-medium text-on-primary">
            Unirme
          </button>
        </form>
      </div>
    </main>
  );
}
