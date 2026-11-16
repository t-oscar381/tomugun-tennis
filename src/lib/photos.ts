/**
 * Photography.
 *
 * Placeholders from Unsplash — real match photos from the group should replace
 * these. Every ID below was downloaded and looked at before shipping, and the
 * alt text describes what is actually in the frame (an earlier pass wrote the
 * alts from memory and several were wrong).
 *
 * The set is chosen to share one palette with the UI: clay orange, court
 * green, long afternoon shadows. A blue hard-court shot would be a fine photo
 * and still look like it came from a different website.
 *
 * Served as plain <img>: this app has no next/image binding on Cloudflare
 * (see open-next.config.ts), and Unsplash already does the resizing for us
 * through its query string.
 */

const BASE = "https://images.unsplash.com/photo-";

export function photo(id: string, width: number, quality = 72): string {
  return `${BASE}${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export interface Shot {
  id: string;
  alt: string;
}

export const SHOTS = {
  /** Aerial of a clay court, a player mid-serve, long shadows. The signature image. */
  serve: { id: "1554068865-24cecd4e34b8", alt: "A player serving on a clay court, seen from above in late-afternoon light" },
  /** Clay, the net, a pair of white shoes and a ball. */
  net: { id: "1530915365347-e35b749a0381", alt: "White tennis shoes and a ball behind the net on a clay court" },
  /** Clay and grass court ringed by palms — the closest thing here to a Jakarta afternoon. */
  palms: { id: "1606151595697-648a9a840cdc", alt: "A clay and grass court surrounded by palm trees" },
  /** Empty court with benches. Calm; good behind text. */
  benches: { id: "1551773188-0801da12ddae", alt: "An empty court with two benches beside the net" },
  /** Clay court from directly above, the net's shadow across it. */
  lines: { id: "1620742820748-87c09249a72a", alt: "The lines of a clay court from directly above" },
  /** Shoes, racket and ball on clay, low angle. */
  ready: { id: "1599586120429-48281b6f0ece", alt: "A racket resting on a ball beside a player's shoes on clay" },
  /** A single court in a forest, from the air. */
  hidden: { id: "1499510318569-1a3d67dc3976", alt: "A lone tennis court surrounded by trees, from the air" },
  /** Green court from above with the net post's shadow. */
  green: { id: "1557561371-160934834af4", alt: "A green court from above with long shadows across it" },
  /** Backhand on a green court, hard shadow. */
  backhand: { id: "1545151414-8a948e1ea54f", alt: "A player hitting a backhand, casting a sharp shadow on a green court" },
  /** Player in orange lunging for a volley. */
  volley: { id: "1622279457486-62dcc4a431d6", alt: "A player in an orange shirt stretching for a volley" },
  /** Racket and balls on grass in dappled light. */
  kit: { id: "1632755898125-36cd72575dde", alt: "A racket and three balls on a court in dappled light" },
  /** Court at golden hour. */
  dusk: { id: "1567220720374-a67f33b2a6b9", alt: "An empty court at golden hour" },
  /** A player at the top of a serve. */
  toss: { id: "1614743758466-e569f4791116", alt: "A player at the top of a service motion" },
  /** The rest are blue hard courts — used only on the formats page. */
  pair: { id: "1515017804404-92b19fdfe6ac", alt: "Two players on a court seen from directly above" },
  rally: { id: "1542446608-e9525230faed", alt: "Two players mid-rally on a hard court" },
  ballLine: { id: "1541744573515-478c959628a0", alt: "A ball resting beside the baseline" },
} satisfies Record<string, Shot>;

/** Big emotional image for the top of the signed-out home page, and the share card. */
export const HERO: Shot = SHOTS.serve;

/** One image per play format (the formats page is not in the nav, but still resolves). */
export const FORMAT_SHOTS: Record<string, Shot> = {
  "classic-ladder": SHOTS.ballLine,
  "rotation-singles": SHOTS.rally,
  "rotation-doubles": SHOTS.pair,
  "fixed-doubles": SHOTS.backhand,
  knockout: SHOTS.green,
};
