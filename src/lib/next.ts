/**
 * Where to send someone after they sign in.
 *
 * Only ever a path on this site: a `next` that could point at another host
 * would turn the join page into an open redirect for anyone crafting a link.
 */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || s.startsWith("/join")) return "/";
  return s.slice(0, 200);
}
