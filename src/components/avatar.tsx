import { petOf, petSrc } from "@/lib/pets";

/**
 * A monogram in place of a photo.
 *
 * Every player used to be the same 🎾 emoji, which made a table of seven
 * people seven identical rows. Initials on a colour that is stable per player
 * lets you find yourself — and your partner — by shape and colour before you
 * have read a single name.
 *
 * The colour comes from the player id, not the name, so renaming yourself
 * doesn't repaint you.
 */

const TONES = [
  "#0b3d2e", // court
  "#d9661a", // clay
  "#1f4f7a", // navy
  "#7a2f4f", // plum
  "#0f766e", // teal
  "#a16207", // mustard
  "#9a3412", // brick
  "#475569", // slate
  "#5b3f8c", // violet
  "#3f6212", // olive
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function toneFor(id: string): string {
  return TONES[hash(id) % TONES.length]!;
}

export function Avatar({
  id,
  name,
  size = 36,
  ring,
  pet,
  className = "",
}: {
  id: string;
  name: string;
  /** The player's stored `emoji` value. A chosen pet shows its face; anything else, initials. */
  pet?: string | null;
  size?: number;
  /** A CSS colour for an outer ring (the podium uses gold / silver / bronze). */
  ring?: string;
  className?: string;
}) {
  const petId = petOf(pet);
  if (petId) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          background: `color-mix(in oklab, ${toneFor(id)} 16%, white)`,
          boxShadow: ring
            ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${ring}`
            : `inset 0 0 0 1px color-mix(in oklab, ${toneFor(id)} 30%, transparent)`,
        }}
      >
        <img src={petSrc(petId)} alt="" width={size} height={size} className="size-[92%] translate-y-[4%] object-contain" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        letterSpacing: "0.02em",
        background: `linear-gradient(140deg, color-mix(in oklab, ${toneFor(id)} 78%, white), ${toneFor(id)})`,
        boxShadow: ring ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${ring}` : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}
