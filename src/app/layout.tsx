import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { HERO, photo } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

/**
 * Inter for everything that is a number. Its tabular figures are why a column
 * of scores lines up instead of shimmering as digits change width — the whole
 * app is a table of numbers, so this is a functional choice, not a stylistic
 * one. Fraunces, a soft serif, carries the headings: it is what makes the
 * place read as a club rather than a spreadsheet.
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const SITE = process.env.SITE_URL ?? "https://play-tennis.tomugun.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Tomugun Tennis",
    // Every other page reads "<page> · Tomugun Tennis" without repeating itself.
    template: "%s · Tomugun Tennis",
  },
  description:
    "Play your usual games, tap who won, and keep points everyone can see.",
  applicationName: "Tomugun Tennis",
  appleWebApp: { capable: true, title: "Tennis", statusBarStyle: "default" },
  // The link gets pasted into WhatsApp — that is the entire growth loop for a
  // Jakarta friend group — so it needs a card, not a bare URL.
  openGraph: {
    type: "website",
    siteName: "Tomugun Tennis",
    title: "Tomugun Tennis",
    description: "Tap who won, keep the points.",
    url: SITE,
    images: [{ url: photo(HERO.id, 1200), width: 1200, height: 800, alt: HERO.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tomugun Tennis",
    description: "Tap who won, keep the points.",
    images: [photo(HERO.id, 1200)],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-[var(--color-bg)]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-clay)] focus:px-4 focus:py-2 focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Tomugun Tennis — home">
              <Mark />
              <span className="leading-none">
                <span className="display block text-lg">Tomugun</span>
                <span className="eyebrow block !text-[9px] text-clay">Tennis</span>
              </span>
            </Link>

            <nav className="flex items-center gap-2 text-sm sm:gap-5">
              {session ? (
                <>
                  <Link href="/" className="hidden font-medium text-muted hover:text-ink sm:block">
                    Scoreboard
                  </Link>
                  <Link href="/how" className="hidden font-medium text-muted hover:text-ink sm:block">
                    How it works
                  </Link>
                  <Link href="/play" className="btn btn-clay !px-4 !py-2 text-sm">
                    Log a game
                  </Link>
                  <AccountMenu
                    name={session.player.name}
                    pet={session.player.emoji}
                    playerId={session.player.id}
                    groupName={session.group.name}
                  />
                </>
              ) : (
                <>
                  <Link href="/how" className="px-1 font-medium text-muted hover:text-ink">
                    How it works
                  </Link>
                  <Link href="/join" className="btn btn-clay !px-5 !py-2 text-sm">
                    Sign in
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
          {children}
        </main>

        <footer className="bg-court-deep text-white/70">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
            <div>
              <div className="flex items-center gap-2.5 text-white">
                <Mark />
                <span className="display text-xl">Tomugun Tennis</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed">
                A scoreboard for friends who share a court. Play your game, tap who won.
              </p>
            </div>
            <nav className="space-y-2.5 text-sm">
              <p className="eyebrow text-lime">The app</p>
              <Link href="/" className="block hover:text-white">
                Scoreboard
              </Link>
              <Link href={session ? "/play" : "/join"} className="block hover:text-white">
                {session ? "Log a game" : "Sign in"}
              </Link>
              <Link href="/how" className="block hover:text-white">
                How it works
              </Link>
              <Link href="/example" className="block hover:text-white">
                Example season
              </Link>
            </nav>
            <div className="space-y-2.5 text-sm">
              <p className="eyebrow text-lime">{session ? "Signed in" : "Jakarta"}</p>
              {session ? (
                <p>
                  <Link href={`/player/${session.player.id}`} className="font-semibold text-white hover:underline">
                    {session.player.name}
                  </Link>
                  <span className="block">{session.group.name}</span>
                </p>
              ) : (
                <p>Made for a weekly game in Jakarta and the courts around it.</p>
              )}
            </div>
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto max-w-6xl px-4 py-5 text-xs sm:px-6">
              © {new Date().getFullYear()} Tomugun · Photography via Unsplash
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

/** The mark: a tennis ball, drawn rather than typed, so it renders the same on every phone. */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#d9f25c" />
      <path
        d="M6 18a34 34 0 0 1 26 26M58 46a34 34 0 0 1-26-26"
        fill="none"
        stroke="#0b3d2e"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
