import { z } from "zod";

// Public values are inlined by Next at build time, so each is read with its literal name.
// Parsed lazily: nothing validates env at import time, so earlier steps' gates never need these values.
const blankToUndefined = (value: string | undefined) => (value === "" ? undefined : value);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SITE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: blankToUndefined(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    NEXT_PUBLIC_SENTRY_DSN: blankToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
  });
}

export type ServerEnvKey = "SUPABASE_SERVICE_ROLE_KEY" | "VAPID_PRIVATE_KEY" | "VAPID_SUBJECT" | "CRON_SECRET";

/** Required only where consumed — §10 "Required by step" is the contract. */
export function requireServerEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}`);
  }
  return value;
}
