import { GoogleLogo } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { DesktopQr } from "@/components/desktop-qr";
import { SubmitButton } from "@/components/submit-button";
import { signIn, signInWithGoogle } from "../actions";

export const metadata: Metadata = { title: "Entra a HomeBoard" };

const ERROR_COPY: Record<string, string> = {
  credenciales_invalidas: "Correo o contraseña incorrectos",
  oauth: "No pudimos entrar con Google. Prueba con tu correo.",
};

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center">Entra a HomeBoard</h1>
      {error && ERROR_COPY[error] && (
        <p role="alert" className="rounded-input bg-muted px-4 py-3 text-sm text-destructive">
          {ERROR_COPY[error]}
        </p>
      )}
      <form action={signInWithGoogle}>
        <SubmitButton
          pendingLabel="Conectando con Google…"
          className="w-full rounded-full border border-border bg-surface py-3 text-sm font-medium"
        >
          <GoogleLogo size={20} aria-hidden="true" />
          Continuar con Google
        </SubmitButton>
      </form>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">o con tu correo</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <form action={signIn} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <SubmitButton
          pendingLabel="Entrando…"
          className="rounded-full bg-primary py-3 text-sm font-medium text-on-primary"
        >
          Entrar
        </SubmitButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary underline-offset-4 hover:underline">
          Crear cuenta nueva
        </Link>
      </p>
      <DesktopQr />
    </section>
  );
}
