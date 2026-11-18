// Applies HomeBoard's settings to the supabase/config.toml that `supabase init` generated.
// Section-aware and idempotent: each call sets one key inside one [section], creating either if absent.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "supabase/config.toml";
const lines = readFileSync(FILE, "utf8").split(/\r?\n/);

function sectionRange(name) {
  const start = lines.findIndex((line) => line.trim() === `[${name}]`);
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function set(section, key, value) {
  let range = sectionRange(section);
  if (range === null) {
    lines.push("", `[${section}]`);
    range = sectionRange(section);
  }
  const pattern = new RegExp(`^\\s*#?\\s*${key}\\s*=`);
  for (let i = range.start + 1; i < range.end; i++) {
    if (pattern.test(lines[i])) {
      lines[i] = `${key} = ${value}`;
      return;
    }
  }
  lines.splice(range.start + 1, 0, `${key} = ${value}`);
}

set("db", "major_version", "17");
set("auth", "site_url", '"http://localhost:3000"');
set(
  "auth",
  "additional_redirect_urls",
  '["http://localhost:3000/auth/callback", "http://localhost:3100/auth/callback", "http://localhost:3101/auth/callback"]',
);
set("auth.email", "enable_signup", "true");
set("auth.email", "enable_confirmations", "false");
// Google is off locally: the real client id/secret only exist in Google Cloud (§20.1 launch checklist).
// To try it locally, export both variables (or put them in supabase/.env) and flip enabled to true.
set("auth.external.google", "enabled", "false");
set("auth.external.google", "client_id", '"env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
set("auth.external.google", "secret", '"env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"');
set("auth.external.google", "skip_nonce_check", "false");

writeFileSync(FILE, `${lines.join("\n").replace(/\n+$/, "")}\n`);
console.log("patch-supabase-config: supabase/config.toml listo");
