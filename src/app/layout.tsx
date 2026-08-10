import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tomugun Tennis",
  description:
    "Play your normal friendly matches, log the score, and get a rank that actually moves.",
};

export const viewport: Viewport = {
  themeColor: "#063528",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The nav differs for signed-in players: "Log" is meaningless until you have
  // a player, and "How it works" matters most before you do.
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-dvh bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-bg)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span aria-hidden>🎾</span>
              <span>Tomugun Tennis</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
              {session ? (
                <>
                  <Link href="/" className="hover:text-[var(--color-ink)]">
                    Ladder
                  </Link>
                  <Link href="/log" className="font-semibold text-[var(--color-clay)]">
                    Log
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/how" className="hover:text-[var(--color-ink)]">
                    How it works
                  </Link>
                  <Link href="/join" className="font-semibold text-[var(--color-clay)]">
                    Join
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">{children}</main>

        <footer className="mx-auto max-w-2xl px-4 pb-10 text-center text-xs text-[var(--color-muted)]">
          <Link href="/how" className="hover:text-[var(--color-ink)]">
            How it works
          </Link>
        </footer>
      </body>
    </html>
  );
}
