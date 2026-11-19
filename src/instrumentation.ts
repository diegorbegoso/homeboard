import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return; // no DSN → Sentry stays uninitialised: a no-op
  }
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export const onRequestError = Sentry.captureRequestError;
