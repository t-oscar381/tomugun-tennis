import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import { HERO, photo } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

/**
 * Inter for everything that is a number. Its tabular figures are why a column
 * of scores lines up instead of shimmering as digits change width — the whole
 * app is a table of numbers, so this is a functional choice, not a stylistic
 * one. Bricolage carries the headings so the app has a voice.
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
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
    "Play your normal friendly matches, log the score, and get a rank that actually moves.",
  applicationName: "Tomugun Tennis",
  appleWebApp: { capable: true, title: "Tennis", statusBarStyle: "default" },
  // The link gets pasted into WhatsApp — that is the entire growth loop for a
  // Jakarta friend group — so it needs a card, not a bare URL.
  openGraph: {
    type: "website",
    siteName: "Tomugun Tennis",
    title: "Tomugun Tennis",
    description: "Log a friendly match, climb a ranked ladder.",
    url: SITE,
    images: [{ url: photo(HERO.id, 1200), width: 1200, height: 800, alt: HERO.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tomugun Tennis",
    description: "Log a friendly match, climb a ranked ladder.",
    images: [photo(HERO.id, 1200)],
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7f3",
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
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bg)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span aria-hidden>🎾</span>
              <span className="hidden sm:inline">Tomugun Tennis</span>
              <span className="sm:hidden">Tennis</span>
            </Link>

            <nav className="flex items-center gap-2 text-sm sm:gap-4">
              {session ? (
                <>
                  <Link
                    href="/"
                    className="hidden px-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] sm:block"
                  >
                    Ladder
                  </Link>
                  <Link
                    href="/log"
                    className="rounded-full bg-[var(--color-clay)] px-4 py-2 font-bold text-white"
                  >
                    Log a match
                  </Link>
                  <AccountMenu
                    name={session.player.name}
                    emoji={session.player.emoji}
                    playerId={session.player.id}
                    rp={session.player.rp}
                    matches={session.player.matches}
                    groupName={session.group.name}
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/how"
                    className="px-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    How it works
                  </Link>
                  <Link
                    href="/join"
                    className="rounded-full bg-[var(--color-clay)] px-4 py-2 font-bold text-white"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-[var(--color-muted)]">
          <Link href="/how" className="hover:text-[var(--color-ink)]">
            How it works
          </Link>
          {session && (
            <>
              <span aria-hidden className="mx-2">
                ·
              </span>
              <span>
                Signed in as{" "}
                <Link
                  href={`/player/${session.player.id}`}
                  className="font-semibold text-[var(--color-ink)] hover:underline"
                >
                  {session.player.name}
                </Link>
              </span>
            </>
          )}
        </footer>
      </body>
    </html>
  );
}
