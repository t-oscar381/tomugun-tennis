/**
 * Names are how people recognise each other, so "dimas" and "Dimas" are the
 * same person to everyone in the group. The database's unique constraint is
 * case-sensitive and happily allowed both — one of them is still sitting in
 * the sample league — so uniqueness is checked here, case-insensitively.
 */

export const MAX_NAME = 24;

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function nameError(name: string): string | null {
  if (!name) return "Type a name.";
  if (name.length > MAX_NAME) return "That name is too long.";
  return null;
}

export function nameTaken(
  players: { id: string; name: string }[],
  name: string,
  exceptId?: string,
): boolean {
  const key = name.toLocaleLowerCase();
  return players.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === key);
}
