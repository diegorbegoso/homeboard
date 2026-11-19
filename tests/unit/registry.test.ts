import { describe, expect, it } from "vitest";
import { enabledMicroApps, ICONOS, MICRO_APPS } from "@/micro-apps/registry";

describe("MICRO_APPS registry", () => {
  it("has unique ids", () => {
    const ids = MICRO_APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every ruta starts with /", () => {
    for (const app of MICRO_APPS) {
      expect(app.ruta.startsWith("/")).toBe(true);
    }
  });

  it("every nombre and descripcion is non-empty", () => {
    for (const app of MICRO_APPS) {
      expect(app.nombre.trim().length).toBeGreaterThan(0);
      expect(app.descripcion.trim().length).toBeGreaterThan(0);
    }
  });

  it("every icono is in ICONOS", () => {
    for (const app of MICRO_APPS) {
      expect(ICONOS as readonly string[]).toContain(app.icono);
    }
  });

  it("only lista-compras is enabled, pointing to /compras", () => {
    const enabled = enabledMicroApps();
    expect(enabled.map((a) => a.id)).toEqual(["lista-compras"]);
    expect(enabled[0]?.ruta).toBe("/compras");
  });
});
