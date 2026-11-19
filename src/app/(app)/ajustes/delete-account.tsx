"use client";

import { useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

// Irreversible: ask first, and spell out what disappears.
export function DeleteAccount({ remove }: Readonly<{ remove: () => Promise<void> }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-2 min-h-11 w-full rounded-full px-4 text-sm font-medium text-destructive underline-offset-4 hover:underline"
      >
        Eliminar mi cuenta
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="eliminar-cuenta-titulo"
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card border border-border bg-surface p-6 text-foreground shadow-sheet backdrop:bg-foreground/40"
      >
        <h2 id="eliminar-cuenta-titulo" className="text-lg font-heading font-extrabold">
          ¿Eliminar tu cuenta?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Saldrás de todos tus hogares y borraremos tus datos para siempre. Los hogares donde queden otras personas
          siguen funcionando; los que se queden sin nadie se eliminan con su lista de compras.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <form action={remove}>
            <SubmitButton
              pendingLabel="Eliminando…"
              className="w-full rounded-full bg-destructive py-3 text-sm font-medium text-on-primary"
            >
              Eliminar cuenta
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
