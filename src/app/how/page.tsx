import Link from "next/link";
import { getSession } from "@/lib/session";
import { FlowDiagram, JoinCta, Steps } from "@/components/how-it-works";

export const dynamic = "force-dynamic";

export const metadata = { title: "How it works" };

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
        <h2 className="text-lg font-bold">How points work</h2>
        <div className="space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm">
          <p>
            <span className="font-semibold">One game, one point each for the winners.</span>{" "}
            <span className="text-[var(--color-muted)]">
              If Tommy &amp; Val beat Rene &amp; Stephanie, Tommy and Val get 1 point each. Rene and
              Stephanie get nothing, but it still counts as a game they played.
            </span>
          </p>
          <p className="text-[var(--color-muted)]">
            Then if Val &amp; Koi play Tommy &amp; Rene and Tommy &amp; Rene win, Tommy has 2 points,
            Val has 1, Rene has 1, Stephanie and Koi have 0. Partners change all the time — that&apos;s
            the point.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Questions people ask</h2>
        <Faq q="Do I type in the score?">
          No. Play to 15, 30, 45 or whatever you like on court — the app only wants to know who won.
        </Faq>
        <Faq q="Who can log a game?">
          Anyone in the group, including someone sitting out. It doesn&apos;t have to be one of the
          four playing, and it shows who logged each game.
        </Faq>
        <Faq q="Someone logged it wrong.">
          Open the day, find the game, tap <em>Remove</em> and then <em>Yes, remove it</em>. Then log
          it again the right way round. Points are worked out from the games, so they correct
          themselves.
        </Faq>
        <Faq q="Two of us logged the same game.">
          It only counts once. If the same teams and the same winner are logged within a minute and a
          half, the second one is turned away.
        </Faq>
        <Faq q="Can I log yesterday's games?">
          Yes. On the Log a game page, tap <em>Day before</em> to go back to any date.
        </Faq>
        <Faq q="Is it only doubles?">
          No. A team can be one person or two, so one against one works too.
        </Faq>
        <Faq q="How do I change my name?">
          Open the menu at the top right, choose <em>My points &amp; name</em>, type it and save.
        </Faq>
      </section>

      {session ? (
        <Link
          href="/play"
          className="block w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 text-center font-bold text-white"
        >
          Log a game
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
