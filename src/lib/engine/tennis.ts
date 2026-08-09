/**
 * Official ITF tennis scoring, as a point-by-point state machine.
 *
 * This is the same engine the app will run in the live scorekeeper — the
 * simulator just feeds it synthetic point winners instead of taps.
 */

export type Side = "A" | "B";

export interface MatchFormat {
  /** Sets needed to win the match (1 = single set, 2 = best-of-3, 3 = best-of-5). */
  setsToWin: 1 | 2 | 3;
  /** Games needed to win a set (6 standard, 4 for short sets). */
  gamesPerSet: number;
  /** Games-all at which a set tiebreak starts (6 => 6-6). Set to 0 to disable. */
  tiebreakAt: number;
  /** Points to win a set tiebreak (7 standard), win by 2. */
  tiebreakTo: number;
  /** Deciding set is a match tiebreak instead of a full set (common in club play). */
  decidingSetIsMatchTiebreak: boolean;
  /** Points to win a match tiebreak (10 standard), win by 2. */
  matchTiebreakTo: number;
  /** No-ad scoring: at deuce, next point wins the game. */
  noAd: boolean;
}

export const FORMATS = {
  /** Standard club best-of-3, full third set. */
  bestOf3: {
    setsToWin: 2,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    decidingSetIsMatchTiebreak: false,
    matchTiebreakTo: 10,
    noAd: false,
  },
  /** Best-of-3 with a 10-point match tiebreak in place of the third set. */
  bestOf3MatchTB: {
    setsToWin: 2,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    decidingSetIsMatchTiebreak: true,
    matchTiebreakTo: 10,
    noAd: false,
  },
  /** One-set friendly — what most weeknight games actually are. */
  singleSet: {
    setsToWin: 1,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    decidingSetIsMatchTiebreak: false,
    matchTiebreakTo: 10,
    noAd: false,
  },
} satisfies Record<string, MatchFormat>;

export interface CompletedSet {
  a: number;
  b: number;
  /** Tiebreak point score, if the set was decided by one. */
  tiebreak?: { a: number; b: number };
  /** True if this "set" was actually a deciding match tiebreak. */
  matchTiebreak?: boolean;
}

const POINT_LABELS = ["0", "15", "30", "40"] as const;

export class TennisMatch {
  readonly format: MatchFormat;

  /** Raw point counts inside the current game (not the 15/30/40 label). */
  pointsA = 0;
  pointsB = 0;

  gamesA = 0;
  gamesB = 0;

  setsA = 0;
  setsB = 0;

  sets: CompletedSet[] = [];

  server: Side;
  /** Who served the first point of the current tiebreak (for rotation). */
  private tiebreakOpener: Side = "A";

  inTiebreak = false;
  isMatchTiebreak = false;
  tbA = 0;
  tbB = 0;

  winner: Side | null = null;

  /** Total points played, useful for pacing/analytics. */
  totalPoints = 0;
  /** Points won on own serve, for hold/break stats. */
  servePointsWon: Record<Side, number> = { A: 0, B: 0 };
  servePointsPlayed: Record<Side, number> = { A: 0, B: 0 };
  breaksOfServe: Record<Side, number> = { A: 0, B: 0 };

  constructor(format: MatchFormat = FORMATS.bestOf3, firstServer: Side = "A") {
    this.format = format;
    this.server = firstServer;
  }

  get isOver(): boolean {
    return this.winner !== null;
  }

  /** Award the current point to `winner` and advance all scoring state. */
  playPoint(winner: Side): void {
    if (this.isOver) throw new Error("match is already over");

    this.totalPoints++;
    this.servePointsPlayed[this.server]++;
    if (winner === this.server) this.servePointsWon[this.server]++;

    if (this.inTiebreak) {
      this.playTiebreakPoint(winner);
      return;
    }

    if (winner === "A") this.pointsA++;
    else this.pointsB++;

    const { noAd } = this.format;
    const [me, them] = winner === "A" ? [this.pointsA, this.pointsB] : [this.pointsB, this.pointsA];

    const gameOver = noAd ? me >= 4 : me >= 4 && me - them >= 2;
    if (gameOver) this.awardGame(winner);
  }

  private playTiebreakPoint(winner: Side): void {
    if (winner === "A") this.tbA++;
    else this.tbB++;

    // Serve changes after the 1st point, then every 2 points.
    const played = this.tbA + this.tbB;
    if ((played - 1) % 2 === 0) {
      this.server = this.server === "A" ? "B" : "A";
    }

    const target = this.isMatchTiebreak ? this.format.matchTiebreakTo : this.format.tiebreakTo;
    const [me, them] = winner === "A" ? [this.tbA, this.tbB] : [this.tbB, this.tbA];
    if (me >= target && me - them >= 2) {
      // A set tiebreak also counts as a game, so the set finishes 7-6 not 6-6.
      if (!this.isMatchTiebreak) {
        if (winner === "A") this.gamesA++;
        else this.gamesB++;
      }
      this.awardSet(winner, { a: this.tbA, b: this.tbB }, this.isMatchTiebreak);
    }
  }

  private awardGame(winner: Side): void {
    const wasBreak = winner !== this.server;
    if (wasBreak) this.breaksOfServe[winner]++;

    if (winner === "A") this.gamesA++;
    else this.gamesB++;

    this.pointsA = 0;
    this.pointsB = 0;
    this.server = this.server === "A" ? "B" : "A";

    const { gamesPerSet, tiebreakAt } = this.format;
    const [me, them] = winner === "A" ? [this.gamesA, this.gamesB] : [this.gamesB, this.gamesA];

    if (me >= gamesPerSet && me - them >= 2) {
      this.awardSet(winner);
      return;
    }

    if (tiebreakAt > 0 && this.gamesA === tiebreakAt && this.gamesB === tiebreakAt) {
      this.inTiebreak = true;
      this.isMatchTiebreak = false;
      this.tbA = 0;
      this.tbB = 0;
      this.tiebreakOpener = this.server;
    }
  }

  private awardSet(
    winner: Side,
    tiebreak?: { a: number; b: number },
    matchTiebreak = false,
  ): void {
    this.sets.push({
      a: matchTiebreak ? (tiebreak ? (tiebreak.a > tiebreak.b ? 1 : 0) : 0) : this.gamesA,
      b: matchTiebreak ? (tiebreak ? (tiebreak.b > tiebreak.a ? 1 : 0) : 0) : this.gamesB,
      tiebreak,
      matchTiebreak: matchTiebreak || undefined,
    });

    if (winner === "A") this.setsA++;
    else this.setsB++;

    // Reset per-set state.
    this.gamesA = 0;
    this.gamesB = 0;
    this.pointsA = 0;
    this.pointsB = 0;
    this.inTiebreak = false;
    this.isMatchTiebreak = false;
    this.tbA = 0;
    this.tbB = 0;

    if (this.setsA >= this.format.setsToWin) {
      this.winner = "A";
      return;
    }
    if (this.setsB >= this.format.setsToWin) {
      this.winner = "B";
      return;
    }

    // Entering the deciding set as a match tiebreak?
    const decidingSetIndex = this.format.setsToWin * 2 - 1; // e.g. 3rd set in bo3
    if (
      this.format.decidingSetIsMatchTiebreak &&
      this.sets.length === decidingSetIndex - 1 &&
      this.setsA === this.setsB
    ) {
      this.inTiebreak = true;
      this.isMatchTiebreak = true;
      this.tbA = 0;
      this.tbB = 0;
      this.tiebreakOpener = this.server;
    }
  }

  /** Umpire-style call for the point in progress, e.g. "40-30", "DEUCE", "AD IN". */
  pointScore(): string {
    if (this.isOver) return "GAME SET MATCH";
    if (this.inTiebreak) return `${this.tbA}-${this.tbB}`;

    const a = this.pointsA;
    const b = this.pointsB;

    if (a >= 3 && b >= 3) {
      if (a === b) return "DEUCE";
      const leader: Side = a > b ? "A" : "B";
      return leader === this.server ? "AD IN" : "AD OUT";
    }
    return `${POINT_LABELS[Math.min(a, 3)]}-${POINT_LABELS[Math.min(b, 3)]}`;
  }

  /** Final scoreline from A's perspective, e.g. "6-4 3-6 7-6(5)". */
  scoreline(): string {
    return this.sets
      .map((s) => {
        if (s.matchTiebreak && s.tiebreak) {
          return `[${s.tiebreak.a}-${s.tiebreak.b}]`;
        }
        const base = `${s.a}-${s.b}`;
        if (!s.tiebreak) return base;
        const loserPoints = Math.min(s.tiebreak.a, s.tiebreak.b);
        return `${base}(${loserPoints})`;
      })
      .join(" ");
  }

  /** Total games won across the match — the margin signal the rating layer uses. */
  gamesWon(): { a: number; b: number } {
    let a = 0;
    let b = 0;
    for (const s of this.sets) {
      a += s.a;
      b += s.b;
    }
    return { a, b };
  }

  /** Serve hold percentage, for the stats page. */
  servePointWinRate(side: Side): number {
    const played = this.servePointsPlayed[side];
    return played === 0 ? 0 : this.servePointsWon[side] / played;
  }

  /** Current tiebreak's opening server — exposed for UI, not used by scoring. */
  currentTiebreakOpener(): Side {
    return this.tiebreakOpener;
  }
}
