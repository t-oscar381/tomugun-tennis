import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tomugun Tennis — the Jakarta ladder",
  description:
    "Log a friendly match, climb a ranked ladder. Real tennis scoring, Apex-style tiers.",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[var(--color-court)]">
        <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-court)]/85 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span aria-hidden>🎾</span>
              <span>Tomugun Tennis</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
              <Link href="/" className="hover:text-[var(--color-ink)]">Ladder</Link>
              <Link href="/log" className="hover:text-[var(--color-ink)]">Log</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">{children}</main>
      </body>
    </html>
  );
}
