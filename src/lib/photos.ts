/**
 * Photography.
 *
 * Placeholders from Unsplash, in the same spirit as the japandi prototype —
 * real match photos from the group should replace these. Every ID below was
 * checked to resolve before shipping, because a broken hero image is worse
 * than no hero image.
 *
 * Served as plain <img>: this app has no next/image binding on Cloudflare
 * (see open-next.config.ts), and Unsplash already does the resizing for us
 * through its query string.
 */

const BASE = "https://images.unsplash.com/photo-";

export function photo(id: string, width: number, quality = 70): string {
  return `${BASE}${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export interface Shot {
  id: string;
  alt: string;
}

/** Big emotional image for the top of the signed-out home page. */
export const HERO: Shot = {
  id: "1554068865-24cecd4e34b8",
  alt: "A player reaching for a forehand on a sunlit court",
};

/** Strip under the hero — the "this is your Tuesday night" feeling. */
export const GALLERY: Shot[] = [
  { id: "1622163642998-1ea32b0bbc67", alt: "Serving into a blue sky" },
  { id: "1545809074-59472b3f5ecc", alt: "Tennis balls resting on the baseline" },
  { id: "1542144582-1ba00456b5e3", alt: "A racket and ball mid-rally" },
  { id: "1595435742656-5272d0b3fa82", alt: "Court lines from above" },
  { id: "1541744573515-478c959628a0", alt: "A player waiting to return serve" },
  { id: "1530915365347-e35b749a0381", alt: "Floodlit court at dusk" },
];

/** One image per step of the walkthrough. */
export const STEP_SHOTS: Shot[] = [
  { id: "1558365849-6ebd8b0454b2", alt: "Players greeting at the net" },
  { id: "1620742820748-87c09249a72a", alt: "A rally in progress" },
  { id: "1499510318569-1a3d67dc3976", alt: "A scoreboard beside the court" },
  { id: "1545151414-8a948e1ea54f", alt: "Two players shaking hands after a match" },
  { id: "1632755898125-36cd72575dde", alt: "A trophy on court" },
];
