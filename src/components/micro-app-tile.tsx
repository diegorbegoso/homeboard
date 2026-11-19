import { CheckSquare, ShoppingCart, Wallet } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { MicroApp } from "@/micro-apps/registry";

const ICON_MAP = {
  ShoppingCart: <ShoppingCart size={32} weight="duotone" aria-hidden className="text-primary" />,
  CheckSquare: <CheckSquare size={32} weight="duotone" aria-hidden className="text-primary" />,
  Wallet: <Wallet size={32} weight="duotone" aria-hidden className="text-primary" />,
};

export function MicroAppTile({ app }: { app: MicroApp }) {
  return (
    <Link href={app.ruta} className="rounded-card flex min-h-11 flex-col gap-2 border border-border bg-surface p-5">
      {ICON_MAP[app.icono]}
      <span className="font-medium">{app.nombre}</span>
      <span className="text-sm text-muted-foreground">{app.descripcion}</span>
    </Link>
  );
}
