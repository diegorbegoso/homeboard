export const ICONOS = ["ShoppingCart", "CheckSquare", "Wallet"] as const;
export type Icono = (typeof ICONOS)[number];

export type MicroApp = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: Icono;
  ruta: `/${string}`;
  enabled: boolean;
};

export const MICRO_APPS: readonly MicroApp[] = [
  {
    id: "lista-compras",
    nombre: "Lista de compras",
    descripcion: "Lo que falta en casa, compartido al instante.",
    icono: "ShoppingCart",
    ruta: "/compras",
    enabled: true,
  },
];

export const enabledMicroApps = (): MicroApp[] => MICRO_APPS.filter((app) => app.enabled);
