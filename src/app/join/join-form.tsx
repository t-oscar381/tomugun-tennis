"use client";

import { useActionState, useState } from "react";
import { joinAction } from "../actions";

interface Choice {
  id: string;
  name: string;
  emoji: string;
}

export function JoinForm({
  players,
  unlocked,
  wrongCode,
  code,
}: {
  players: Choice[];
  unlocked: boolean;
  wrongCode: boolean;
  code: string;
}) {
  if (!unlocked) return <CodeStep wrongCode={wrongCode} />;
  return <IdentityStep players={players} code={code} />;
}

/**
 * Step one. A plain GET form, so it works with no JavaScript and leaves the
 * code in the URL — which is what makes an invite link possible.
 *
 * No placeholder here on purpose: it used to read "DEUCE", which was the
 * actual live code printed on the page.
 */
function CodeStep({ wrongCode }: { wrongCode: boolean }) {
  return (
    <form method="get" action="/join" className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Group code</span>
        <input
          name="c"
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={wrongCode || undefined}
          className="nums w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-lg uppercase tracking-widest outline-none focus:border-[var(--color-clay)]"
        />
      </label>

      {wrongCode && (
        <p className="text-sm text-[var(--color-loss)]">
          That code isn&apos;t right. Ask whoever sent you the link.
        </p>
      )}

      <button className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 font-bold text-white">
        Continue
      </button>
    </form>
  );
}

/**
 * Step two. Someone arriving from an invite is almost always new, so "add me"
 * is the default and picking an existing name is the secondary path — the
 * reverse of how this used to work, which showed a newcomer ten strangers'
 * names and no obvious way in.
 */
function IdentityStep({ players, code }: { players: Choice[]; code: string }) {
  const [state, action, pending] = useActionState(joinAction, {});
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(true);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="code" value={code} />

      {creating ? (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">What should we call you?</span>
            <input
              name="newName"
              required
              autoFocus
              maxLength={24}
              placeholder="Your name"
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-lg outline-none focus:border-[var(--color-clay)]"
            />
            <span className="block text-xs text-[var(--color-muted)]">
              However your group knows you — this is what shows on the ladder.
            </span>
          </label>

          {players.length > 0 && (
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-[var(--color-muted)] underline"
            >
              I&apos;m already on the list
            </button>
          )}
        </>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Which one are you?</legend>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  selected === p.id
                    ? "border-[var(--color-clay)] bg-[var(--color-clay-soft)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                <input
                  type="radio"
                  name="playerId"
                  value={p.id}
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                  className="sr-only"
                />
                <span aria-hidden>{p.emoji}</span>
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setSelected("");
            }}
            className="text-sm text-[var(--color-muted)] underline"
          >
            I&apos;m not on this list — add me
          </button>
        </fieldset>
      )}

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending || (!creating && !selected)}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Joining…" : "Join the league"}
      </button>
    </form>
  );
}
