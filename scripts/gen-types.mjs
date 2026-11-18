// Regenerates src/lib/database.types.ts from the LOCAL database (supabase CLI v3 reads it by default).
// A script instead of a shell redirect so the same command works in Git Bash, PowerShell and CI.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "src/lib/database.types.ts";
const types = execSync("pnpm exec supabase gen types --lang typescript --local", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 20 * 1024 * 1024,
});

if (!types.includes("export type Database")) {
  console.error("db:types — la salida no contiene `export type Database`; ¿está corriendo `pnpm db:start`?");
  process.exit(1);
}

writeFileSync(OUT, types);
console.log(`db:types — ${OUT} actualizado`);
