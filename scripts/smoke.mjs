// Runs the production build produced by `pnpm build` and requests it — the entry point is RUN, not just built.
// Spawns the Next binary with the current Node directly (no shell).
// server.unref() lets this script's event loop exit naturally; process.exit() terminates the child on all OSes.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const CHECKS = [{ path: "/", status: 200, contains: "HomeBoard" }];

if (!existsSync(".next/BUILD_ID")) {
  console.error("smoke: no hay build de producción — ejecuta `pnpm build` primero");
  process.exit(2);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(PORT)], {
  // pipe instead of inherit: avoids a libuv UV_HANDLE_CLOSING assertion on Windows when this
  // process calls process.exit() while the child still holds the shared stdio handles.
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});
server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);
// unref() so this process's event loop is not kept alive by the child handle.
server.unref();

async function waitUntilUp(deadline) {
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("smoke: el servidor no arrancó en 60 s");
}

let failed = false;
try {
  await waitUntilUp(Date.now() + 60_000);
  for (const check of CHECKS) {
    const response = await fetch(`${BASE}${check.path}`);
    const body = await response.text();
    const ok = response.status === check.status && body.includes(check.contains);
    console.log(`${ok ? "ok  " : "FAIL"} GET ${check.path} -> ${response.status} (final ${response.url})`);
    if (!ok) {
      failed = true;
    }
  }
} catch (error) {
  console.error(error);
  failed = true;
}

// Wait for the child to close before exiting; a 3 s fallback covers the Windows case where
// the close event never fires. Both paths exit with the correct code.
const exitCode = failed ? 1 : 0;
server.on("close", () => process.exit(exitCode));
setTimeout(() => process.exit(exitCode), 3000).unref();
server.kill();
