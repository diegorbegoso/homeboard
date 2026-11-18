// Applies the blueprint's edits on top of the create-next-app scaffold.
// Idempotent: every edit sets a value instead of appending, so §10 Bootstrap can run it any number of times.
// Owns: package.json name/packageManager/engines/scripts, tsconfig.json exclude, next.config.ts cacheComponents.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const pkg = readJson("package.json");
pkg.name = "homeboard";
pkg.private = true;
pkg.packageManager = "pnpm@12.21.0";
pkg.engines = { node: ">=24" };
pkg.scripts = {
  dev: "next dev",
  build: "next build",
  start: "next start",
  lint: "biome check .",
  format: "biome format --write .",
  typecheck: "next typegen && tsc --noEmit",
  test: "vitest run",
  "test:e2e": "playwright test",
  smoke: "node scripts/smoke.mjs",
  icons: "node scripts/generate-icons.mjs",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:test": "supabase test db",
  "db:types": "node scripts/gen-types.mjs",
  "db:config": "node scripts/patch-supabase-config.mjs",
  "env:local": "node scripts/write-env-local.mjs",
};
writeJson("package.json", pkg);

const tsconfig = readJson("tsconfig.json");
const exclude = new Set(tsconfig.exclude ?? []);
for (const entry of ["node_modules", "blueprints", "supabase"]) {
  exclude.add(entry);
}
tsconfig.exclude = [...exclude];
writeJson("tsconfig.json", tsconfig);

// Next 16's scaffold turns on cacheComponents + partialPrefetching. HomeBoard opts out of both:
// cacheComponents forces every cookies() read into a <Suspense> boundary (§20.3 #9), and
// partialPrefetching requires cacheComponents — keeping it true while cacheComponents is false
// causes a build error ("partialPrefetching requires cacheComponents to be enabled").
for (const file of ["next.config.ts", "next.config.mjs"]) {
  if (existsSync(file)) {
    let patched = readFileSync(file, "utf8");
    patched = patched.replace(/cacheComponents:\s*true/, "cacheComponents: false");
    patched = patched.replace(/partialPrefetching:\s*true/, "partialPrefetching: false");
    writeFileSync(file, patched);
  }
}

console.log("apply-scaffold-edits: package.json, tsconfig.json y next.config listos");
