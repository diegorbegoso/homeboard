import { SubmitButton } from "@/components/submit-button";
import { crearHogar, unirseAHogar } from "./actions";

const INPUT =
  "rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
const BUTTON = "rounded-full bg-primary py-3 text-sm font-medium text-on-primary";

// Create-or-join cards shared by onboarding (/bienvenida) and the households page (/hogares).
export function HouseholdForms({ back }: Readonly<{ back: "/bienvenida" | "/hogares" }>) {
  return (
    <>
      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-heading font-extrabold">Crea tu hogar</h2>
        <form action={crearHogar} className="flex flex-col gap-4">
          <input type="hidden" name="volver" value={back} />
          <div className="flex flex-col gap-1">
            <label htmlFor="nombre-hogar" className="text-sm font-medium">
              Nombre del hogar
            </label>
            <input id="nombre-hogar" name="nombre" type="text" required className={INPUT} />
          </div>
          <SubmitButton pendingLabel="Creando tu hogar…" className={BUTTON}>
            Crear hogar
          </SubmitButton>
        </form>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-heading font-extrabold">Únete con un código</h2>
        <form action={unirseAHogar} className="flex flex-col gap-4">
          <input type="hidden" name="volver" value={back} />
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
              className={`${INPUT} uppercase tracking-widest`}
            />
          </div>
          <SubmitButton pendingLabel="Uniéndote…" className={BUTTON}>
            Unirme
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
