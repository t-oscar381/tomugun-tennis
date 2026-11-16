/**
 * Pets: the faces people can pick for themselves.
 *
 * The drawings come from celebration.tomugun.com, where they are whole
 * articulated animals; these are just the heads, cropped to 200px squares in
 * public/pets. A player's choice is stored in the existing `emoji` column as
 * `pet:<id>`, so this needed no database change — anything else in that column
 * (the default 🎾) simply means "no pet yet" and the initials badge is shown.
 */

export interface Pet {
  id: string;
  name: string;
  species: "dog" | "cat";
}

export const PETS: Pet[] = [
  { id: "pomeranian", name: "Pomeranian", species: "dog" },
  { id: "french-bulldog", name: "French Bulldog", species: "dog" },
  { id: "dachshund", name: "Long-haired Dachshund", species: "dog" },
  { id: "short-haired-dachshund", name: "Dachshund", species: "dog" },
  { id: "golden-retriever", name: "Golden Retriever", species: "dog" },
  { id: "labrador", name: "Labrador", species: "dog" },
  { id: "beagle", name: "Beagle", species: "dog" },
  { id: "corgi", name: "Corgi", species: "dog" },
  { id: "shiba", name: "Shiba Inu", species: "dog" },
  { id: "husky", name: "Husky", species: "dog" },
  { id: "poodle", name: "Poodle", species: "dog" },
  { id: "chihuahua", name: "Chihuahua", species: "dog" },
  { id: "chow-chow", name: "Chow Chow", species: "dog" },
  { id: "whippet", name: "Whippet", species: "dog" },
  { id: "shih-tzu", name: "Shih Tzu", species: "dog" },
  { id: "maltese", name: "Maltese", species: "dog" },
  { id: "border-collie", name: "Border Collie", species: "dog" },
  { id: "local-mixed-dog", name: "Mixed-breed dog", species: "dog" },
  { id: "domestic-tabby", name: "Tabby", species: "cat" },
  { id: "orange-tabby", name: "Orange tabby", species: "cat" },
  { id: "tuxedo-cat", name: "Tuxedo cat", species: "cat" },
  { id: "calico-cat", name: "Calico", species: "cat" },
  { id: "british-shorthair", name: "British Shorthair", species: "cat" },
  { id: "persian-cat", name: "Persian", species: "cat" },
  { id: "siamese-cat", name: "Siamese", species: "cat" },
  { id: "maine-coon", name: "Maine Coon", species: "cat" },
  { id: "ragdoll-cat", name: "Ragdoll", species: "cat" },
  { id: "sphynx-cat", name: "Sphynx", species: "cat" },
];

const IDS = new Set(PETS.map((p) => p.id));
const PREFIX = "pet:";

/** The pet id stored in a player's `emoji` column, or null if they haven't picked one. */
export function petOf(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(PREFIX)) return null;
  const id = stored.slice(PREFIX.length);
  return IDS.has(id) ? id : null;
}

/** Stored when someone says "just use my initials", so the front page stops asking. */
const INITIALS = "initials";

/** What to write to the column for a choice. Anything that isn't a pet means "initials". */
export function petValue(id: string): string {
  return IDS.has(id) ? PREFIX + id : INITIALS;
}

/** Has this player answered the "pick your pet" question, either way? */
export function hasChosenFace(stored: string | null | undefined): boolean {
  return stored === INITIALS || petOf(stored) !== null;
}

export const petSrc = (id: string) => `/pets/${id}.webp`;
