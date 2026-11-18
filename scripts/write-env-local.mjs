// Writes .env.local from the running local Supabase stack (`pnpm db:start` first).
// Supabase values are refreshed on every run; every other key already present is kept,
// so VAPID keys and CRON_SECRET are generated once and never rotate under you. Safe to re-run.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";

const FILE = ".env.local";

const current = new Map();
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      current.set(match[1], match[2]);
    }
  }
}

const status = JSON.parse(
  execSync("pnpm exec supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

function pick(...keys) {
  for (const key of keys) {
    if (typeof status[key] === "string" && status[key] !== "") {
      return status[key];
    }
  }
  console.error(`env:local — supabase status no devolvió ninguna de: ${keys.join(", ")}`);
  process.exit(1);
}

const fromSupabase = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("ANON_KEY", "PUBLISHABLE_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: pick("SERVICE_ROLE_KEY", "SECRET_KEY"),
};

const vapid = current.get("VAPID_PRIVATE_KEY") ? null : generateVAPIDKeys();
const defaults = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid?.publicKey,
  VAPID_PRIVATE_KEY: vapid?.privateKey,
  VAPID_SUBJECT: "mailto:hola@homeboard.test",
  CRON_SECRET: randomBytes(32).toString("hex"),
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SENTRY_DSN: "",
};

const next = new Map(current);
for (const [key, value] of Object.entries(fromSupabase)) {
  next.set(key, value);
}
for (const [key, value] of Object.entries(defaults)) {
  if (!next.get(key) && value !== undefined) {
    next.set(key, value);
  }
}

const body = [...next.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");
writeFileSync(FILE, `# Generado por \`pnpm env:local\`. Nunca se commitea.\n${body}\n`);
console.log(`env:local — ${next.size} variables escritas en ${FILE}`);
