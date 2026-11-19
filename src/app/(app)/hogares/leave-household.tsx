"use client";

import { useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

type Props = Readonly<{
  householdId: string;
  name: string;
  isLastMember: boolean;
  leave: (formData: FormData) => Promise<void>;
}>;

// Leaving removes the household from the user's list, so it asks first.
export function LeaveHousehold({ householdId, name, isLastMember, leave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="min-h-11 rounded-full px-3 text-sm font-medium text-destructive"
      >
        <span className="sr-only">Salir de {name}</span>
        <span aria-hidden="true">Salir</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`salir-${householdId}`}
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card border border-border bg-surface p-6 text-foreground shadow-sheet backdrop:bg-foreground/40"
      >
        <h2 id={`salir-${householdId}`} className="text-lg font-heading font-extrabold">
          ¿Salir de {name}?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLastMember
            ? "Eres la última persona: el hogar y su lista de compras se eliminarán para siempre."
            : "Dejarás de ver su lista de compras. Podrás volver con el código de invitación."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <form action={leave}>
            <input type="hidden" name="hogar" value={householdId} />
            <SubmitButton
              pendingLabel="Saliendo…"
              className="w-full rounded-full bg-destructive py-3 text-sm font-medium text-on-primary"
            >
              Salir del hogar
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
