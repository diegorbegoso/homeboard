"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

// Confirmation before ending the session: the sign-out tab sits next to navigation, so a stray tap must not log anyone out.
export function SignOutTab({ signOut }: Readonly<{ signOut: () => Promise<void> }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground"
      >
        <SignOut size={24} weight="regular" aria-hidden="true" />
        Salir
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="salir-titulo"
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card border border-border bg-surface p-6 text-foreground shadow-sheet backdrop:bg-foreground/40"
      >
        <h2 id="salir-titulo" className="text-lg font-heading font-extrabold">
          ¿Cerrar sesión?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Tendrás que volver a entrar para ver tu hogar.</p>
        <div className="mt-6 flex flex-col gap-3">
          <form action={signOut}>
            <SubmitButton
              pendingLabel="Cerrando sesión…"
              className="w-full rounded-full bg-destructive py-3 text-sm font-medium text-on-primary"
            >
              Cerrar sesión
            </SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 w-full rounded-full border border-border py-3 text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </dialog>
    </>
  );
}
