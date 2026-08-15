import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tomugun Tennis",
  description:
    "Play your normal friendly matches, log the score, and get a rank that actually moves.",
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
    <html lang="en">
      <body className="min-h-dvh bg-[var(--color-bg)]">
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

        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>

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
