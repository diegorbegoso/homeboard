import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));
const db = vi.hoisted(() => ({ result: { error: null } as { error: { code: string } | null } }));

vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: async () => db.result }) }),
}));

describe("Sentry register", () => {
  it("does not initialise without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { register } = await import("@/instrumentation");
    await register();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("initialises once with the DSN", async () => {
    const dsn = "https://public@o0.ingest.sentry.io/0";
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const { register } = await import("@/instrumentation");
    await register();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn }));
  });
});

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one JSON line and redacts sensitive keys", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { log } = await import("@/lib/log");
    log.error("prueba", { email: "a@b.c", token: "t", code: "X1" });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({
      level: "error",
      event: "prueba",
      code: "X1",
      email: "[redacted]",
      token: "[redacted]",
    });
  });
});

describe("health route", () => {
  const call = async (authorization?: string) => {
    const { GET } = await import("@/app/api/health/route");
    const headers = authorization ? { authorization } : undefined;
    const response = await GET(new Request("http://localhost/api/health", { headers }));
    return { status: response.status, body: await response.json() };
  };

  it("rejects a missing or wrong bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    expect(await call()).toEqual({ status: 401, body: { ok: false, error: "unauthorized" } });
    expect(await call("Bearer wrong")).toEqual({ status: 401, body: { ok: false, error: "unauthorized" } });
  });

  it("answers 200 with the secret and a working database", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    db.result = { error: null };
    expect(await call("Bearer s3cr3t")).toEqual({ status: 200, body: { ok: true } });
  });

  it("answers 503 when the query fails", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    db.result = { error: { code: "XX" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await call("Bearer s3cr3t")).toEqual({ status: 503, body: { ok: false, error: "db" } });
  });

  it("exports GET", async () => {
    const route = await import("@/app/api/health/route");
    expect(typeof route.GET).toBe("function");
  });
});

describe("vercel.json", () => {
  it("has one daily health cron", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(config.crons).toHaveLength(1);
    expect(config.crons[0]?.path).toBe("/api/health");
    expect(config.crons[0]?.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});

describe("ci.yml", () => {
  type Workflow = { jobs: Record<string, { steps: { run?: string }[] }> };
  const workflow = JSON.parse(
    readFileSync(".github/workflows/ci.yml", "utf8").replace(/,(\s*[}\]])/g, "$1"),
  ) as Workflow;
  const runs = Object.values(workflow.jobs).flatMap((job) => job.steps.flatMap((step) => (step.run ? [step.run] : [])));

  it("runs the gate commands in order", () => {
    const expected = [
      "pnpm install --frozen-lockfile",
      "pnpm exec biome ci .",
      "pnpm typecheck",
      "pnpm test",
      "pnpm db:test",
      "pnpm test:e2e",
      "pnpm build",
    ];
    const positions = expected.map((command) => runs.indexOf(command));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("only runs pnpm scripts that exist", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    for (const run of runs) {
      const match = /^pnpm (\S+)/.exec(run);
      const name = match?.[1];
      if (name && name !== "install" && name !== "exec") {
        expect(scripts, run).toHaveProperty(name);
      }
    }
  });
});
