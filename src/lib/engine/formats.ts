/**
 * The series a group can choose to play.
 *
 * The app started with one assumption baked in — singles, ranked, one match at
 * a time — which is only one of the ways this group actually plays. Social
 * nights in the pickleball mould shuffle partners every round and care more
 * about everyone getting court time than about who won.
 *
 * `status` is load-bearing and deliberately honest:
 *   live    — fully working, results move the ladder.
 *   social  — the scheduling works; results are NOT ladder-rated yet, because
 *             rating a doubles pair needs a team model (TrueSkill), not the
 *             Glicko-2 singles rating this app runs on. Claiming otherwise
 *             would put fictional numbers on the ladder.
 *   planned — not built.
 */

export type FormatStatus = "live" | "social" | "planned";

export interface PlayFormat {
  id: string;
  name: string;
  tagline: string;
  /** Players per side. 1 = singles, 2 = doubles. */
  teamSize: 1 | 2;
  /** Do partners change between rounds? */
  rotating: boolean;
  status: FormatStatus;
  /** Where the "start" button goes, when there is one. */
  href?: string;
  blurb: string;
  bullets: string[];
  bestFor: string;
}

export const PLAY_FORMATS: PlayFormat[] = [
  {
    id: "classic-ladder",
    name: "Classic ladder",
    tagline: "Singles · Ranked",
    teamSize: 1,
    rotating: false,
    status: "live",
    href: "/log",
    blurb:
      "The default. You arrange a singles match with whoever you like, play it, log the score. Every result moves both players up or down the ladder.",
    bullets: [
      "Play anyone, any time — no fixture list",
      "Rank points at stake on every match",
      "Beating someone above you pays the most",
    ],
    bestFor: "A group that wants a standing pecking order.",
  },
  {
    id: "rotation-singles",
    name: "Rotation night — singles",
    tagline: "Singles · Ranked · Random opponents",
    teamSize: 1,
    rotating: true,
    status: "live",
    href: "/formats/rotation?team=1",
    blurb:
      "Everyone turns up, the app draws the fixtures. Each round you face someone different, chosen to spread court time evenly rather than at random.",
    bullets: [
      "Fixtures drawn for you, round by round",
      "Everyone plays the same number of matches",
      "Still 1-v-1, so every result counts on the ladder",
    ],
    bestFor: "A club night where nobody wants to organise the draw.",
  },
  {
    id: "rotation-doubles",
    name: "Rotation night — doubles",
    tagline: "Doubles · Social · Partners shuffle",
    teamSize: 2,
    rotating: true,
    status: "social",
    href: "/formats/rotation?team=2",
    blurb:
      "The pickleball format. Your partner changes every round, so you finish the night having played with most of the group instead of the same person for two hours.",
    bullets: [
      "New partner almost every round",
      "Court time and byes shared out evenly",
      "Great for mixed abilities — the draw does the mixing",
    ],
    bestFor: "A big, social turnout where the point is playing with everyone.",
  },
  {
    id: "fixed-doubles",
    name: "Doubles ladder",
    tagline: "Doubles · Fixed partner",
    teamSize: 2,
    rotating: false,
    status: "planned",
    blurb:
      "You and a regular partner climb as a team. Not built: rating a pair properly needs a team model rather than the singles rating this ladder runs on, and faking it would put made-up numbers on the board.",
    bullets: [
      "Pick a partner, rank as a team",
      "Needs a team rating model (TrueSkill)",
      "Tell me if you want this next",
    ],
    bestFor: "Groups who always play with the same partner.",
  },
];

export function formatById(id: string): PlayFormat | undefined {
  return PLAY_FORMATS.find((f) => f.id === id);
}

export const STATUS_LABEL: Record<FormatStatus, string> = {
  live: "Counts on the ladder",
  social: "Social — not ranked yet",
  planned: "Not built yet",
};
