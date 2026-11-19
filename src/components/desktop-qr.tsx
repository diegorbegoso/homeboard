import { headers } from "next/headers";
import { qrPath } from "@/lib/qr";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Desktop-only card: scan it with a phone to open the app there. Hidden on small screens and on
// localhost (a phone could not reach it).
export async function DesktopQr() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || LOCAL_HOST.test(host)) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const { d, size } = qrPath(`${proto}://${host}/entrar`);

  return (
    <aside
      data-testid="desktop-qr"
      className="mx-auto hidden w-full max-w-sm flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center lg:flex"
    >
      <h2 className="text-lg font-heading font-extrabold">Ábrela en tu teléfono</h2>
      {/* White square with a quiet zone keeps the code scannable in dark mode too. */}
      <div className="rounded-input bg-white p-3">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Código QR para abrir HomeBoard en tu teléfono"
          shapeRendering="crispEdges"
          className="size-40 fill-black"
        >
          <path d={d} />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">Apunta la cámara y entra a HomeBoard desde el móvil.</p>
    </aside>
  );
}
