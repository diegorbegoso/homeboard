import type { Metadata } from "next";
import Link from "next/link";
import { DesktopQr } from "@/components/desktop-qr";
import { SubmitButton } from "@/components/submit-button";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crea tu cuenta" };

const ERROR_COPY: Record<string, string> = {
  contrasena_corta: "La contraseña necesita al menos 8 caracteres",
  correo_en_uso: "Ya hay una cuenta con ese correo",
  datos_invalidos: "Revisa los datos e inténtalo de nuevo",
};

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center">Crea tu cuenta</h1>
      {error && ERROR_COPY[error] && (
        <p role="alert" className="rounded-input bg-muted px-4 py-3 text-sm text-destructive">
          {ERROR_COPY[error]}
        </p>
      )}
      <form action={signUp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            required
            className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="correo" className="text-sm font-medium">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="email"
            required
            className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contrasena" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="contrasena"
            name="contrasena"
            type="password"
            autoComplete="new-password"
            className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <SubmitButton
          pendingLabel="Creando tu cuenta…"
          className="rounded-full bg-primary py-3 text-sm font-medium text-on-primary"
        >
          Crear cuenta
        </SubmitButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Ya tengo cuenta
        </Link>
      </p>
      <DesktopQr />
    </section>
  );
}
