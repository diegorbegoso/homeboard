import { WifiSlash } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <section className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <WifiSlash size={48} aria-hidden="true" className="text-muted-foreground" />
      <h1>Sin conexión</h1>
      <p className="text-muted-foreground">
        HomeBoard necesita internet para sincronizar la lista. Vuelve a intentarlo cuando tengas señal.
      </p>
      <a href="/" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary">
        Reintentar
      </a>
    </section>
  );
}
