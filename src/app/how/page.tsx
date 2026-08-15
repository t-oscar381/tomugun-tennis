import Link from "next/link";
import { getSession } from "@/lib/session";
import { FlowDiagram, JoinCta, RankExplainer, Steps } from "@/components/how-it-works";

export const dynamic = "force-dynamic";

export const metadata = { title: "How it works — Tomugun Tennis" };

export default async function HowPage() {
  const session = await getSession();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <FlowDiagram />
        <Steps />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">The ranks</h2>
        <RankExplainer />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Writing the score</h2>
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm">
          <p className="text-[var(--color-muted)]">
            Always type <span className="text-[var(--color-ink)]">your own games first</span>, set
            by set, with a space between sets.
          </p>
          <ul className="nums space-y-1.5 text-[var(--color-ink)]">
            <li>
              <span className="font-semibold">6-4 6-3</span>{" "}
              <span className="text-[var(--color-muted)]">— straight sets</span>
            </li>
            <li>
              <span className="font-semibold">7-6(4)</span>{" "}
              <span className="text-[var(--color-muted)]">— tiebreak set, in brackets is what the LOSER scored</span>
            </li>
            <li>
              <span className="font-semibold">6-4 3-6 [10-8]</span>{" "}
              <span className="text-[var(--color-muted)]">— a deciding match tiebreak in square brackets</span>
            </li>
            <li>
              <span className="font-semibold">4-6 2-6</span>{" "}
              <span className="text-[var(--color-muted)]">— a loss, still your games first</span>
            </li>
          </ul>
          <p className="text-[var(--color-muted)]">
            If you mistype something impossible the app will tell you rather than saving it.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Questions people ask</h2>
        <Faq q="I logged it — why hasn't my rank changed?">
          Your opponent has to confirm it first. Until they do, nothing moves.
        </Faq>
        <Faq q="Someone logged a match wrong.">
          Tap <em>That&apos;s wrong</em> on your home screen. It gets thrown out, and whoever was
          right logs it again.
        </Faq>
        <Faq q="Why did I barely gain anything for that win?">
          You were expected to win, and beating the same person repeatedly pays less each time.
          Beat someone above you for a real jump.
        </Faq>
        <Faq q="I lost but didn't drop much.">
          Losing to someone much better is nearly free. Losing to someone below you is not.
        </Faq>
        <Faq q="Can I play doubles?">
          Not yet — singles only for now.
        </Faq>
      </section>

      {session ? (
        <Link
          href="/log"
          className="block w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 text-center font-bold text-white"
        >
          Log a match
        </Link>
      ) : (
        <JoinCta />
      )}
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <summary className="cursor-pointer list-none font-semibold marker:hidden">
        <span className="mr-2 text-[var(--color-clay)] group-open:hidden">+</span>
        <span className="mr-2 hidden text-[var(--color-clay)] group-open:inline">−</span>
        {q}
      </summary>
      <p className="mt-2 pl-5 text-sm text-[var(--color-muted)]">{children}</p>
    </details>
  );
}
