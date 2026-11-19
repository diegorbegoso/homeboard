type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE = /(token|secret|password|contrasena|key|auth|p256dh|endpoint|email|correo)/i;

function redact(context: Context): Context {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, SENSITIVE.test(key) ? "[redacted]" : value]),
  );
}

function write(level: Level, event: string, context: Context = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...redact(context) });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (event: string, context?: Context) => write("info", event, context),
  warn: (event: string, context?: Context) => write("warn", event, context),
  error: (event: string, context?: Context) => write("error", event, context),
};
