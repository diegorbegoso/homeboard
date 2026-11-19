/** Only same-origin relative paths survive; everything else becomes "/". Blocks open redirects. */
export function safeNextPath(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
