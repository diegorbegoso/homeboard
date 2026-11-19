import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

const BASE = "http://localhost:3000/auth/callback";

function call(query: string, headers: Record<string, string> = {}) {
  return GET(new NextRequest(`${BASE}${query}`, { headers }));
}

describe("GET /auth/callback", () => {
  it("exchanges the code and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call("?code=abc&next=/compras");
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/compras");
  });

  it("redirects to /entrar?error=oauth without a code", async () => {
    const response = await call("");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/entrar?error=oauth");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to /entrar?error=oauth when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    const response = await call("?code=bad");
    expect(response.headers.get("location")).toBe("http://localhost:3000/entrar?error=oauth");
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example"])("rejects next=%s", async (next) => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call(`?code=abc&next=${encodeURIComponent(next)}`);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("honours x-forwarded-host outside development", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call("?code=abc&next=/compras", { "x-forwarded-host": "homeboard.vercel.app" });
    expect(response.headers.get("location")).toBe("https://homeboard.vercel.app/compras");
  });
});
