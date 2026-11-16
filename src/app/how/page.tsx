import { getSession } from "@/lib/session";
import { SHOTS } from "@/lib/photos";
import { ClosingCta, Features, Steps } from "@/components/how-it-works";
import { Avatar } from "@/components/avatar";
import { Banner } from "@/components/photo";

export const dynamic = "force-dynamic";

export const metadata = { title: "How it works" };

export default async function HowPage() {
  const session = await getSession();

  return (
    <div className="space-y-16 sm:space-y-24">
      <Banner shot={SHOTS.toss} eyebrow="How it works" title={<>Play, then <em className="text-lime">tap who won.</em></>}>
        No scores to type and no rules to learn. Here is the whole thing in three steps.
      </Banner>

      <Steps />

      {/* ── The points, worked through with the names from a real evening. */}
      <section className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow text-clay">How points work</p>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
            One game. One point each <em className="text-clay">for the winners.</em>
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            The losing team gets nothing, but it still counts as a game they played. Partners
            change all the time — the points follow the person, not the pair.
          </p>
        </div>

        <ol className="space-y-4">
          <Example
            n={1}
            win={["Tommy", "Val"]}
            lose={["Rene", "Stephanie"]}
            after={[["Tommy", 1], ["Val", 1], ["Rene", 0], ["Stephanie", 0]]}
          />
          <Example
            n={2}
            win={["Tommy", "Rene"]}
            lose={["Val", "Koi"]}
            after={[["Tommy", 2], ["Val", 1], ["Rene", 1], ["Stephanie", 0], ["Koi", 0]]}
          />
        </ol>
      </section>

      <Features />

      <section className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <p className="eyebrow text-clay">Questions people ask</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Before you ask in the group chat</h2>
        </div>
        <div className="card divide-y divide-line overflow-hidden">
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
            Open the menu at the top right, choose <em>My points, name &amp; pet</em>, type it and save.
          </Faq>
        </div>
      </section>

      <ClosingCta
        title={session ? <>Court&apos;s free. <em className="text-lime">Log a game.</em></> : <>Ready when <em className="text-lime">you are.</em></>}
        body={session ? "Tap the teams, tap who won. Five seconds." : "Open the invite link from your group, add your name, and you're on the board."}
        href={session ? "/play" : "/join"}
        label={session ? "Log a game" : "Join the group"}
      />
    </div>
  );
}

function Example({
  n,
  win,
  lose,
  after,
}: {
  n: number;
  win: string[];
  lose: string[];
  after: [string, number][];
}) {
  return (
    <li className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3">
        <span className="display text-lg italic text-clay">Game {n}</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm">
          <strong>{win.join(" & ")}</strong> <span className="text-muted">beat</span> {lose.join(" & ")}
        </p>
        <ul className="flex flex-wrap gap-2">
          {after.map(([name, pts]) => (
            <li
              key={name}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${
                win.includes(name) ? "border-clay/40 bg-clay-soft" : "border-line bg-bg"
              }`}
            >
              <Avatar id={name} name={name} size={26} />
              <span className="font-semibold">{name}</span>
              <span className="display nums text-lg leading-none">{pts}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
        {q}
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-clay transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{children}</p>
    </details>
  );
}
