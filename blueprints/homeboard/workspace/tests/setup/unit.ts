// Unit tests never read .env.local: they must pass on a machine with no Supabase running.
// Modules that read public env at call time get harmless values here; tests stub anything else with vi.stubEnv.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "unit-test-anon-key";
