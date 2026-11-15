"use client";

import { useActionState } from "react";
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
 * No placeholder here on purpose: it used to show the real code, which was the
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
 * Step two: add yourself, or tap your slot.
 *
 * Adding a player comes first. The pool is bigger than the people who happened
 * to be at the first session, and the eighth person arriving through this link
 * is exactly who the form should expect — not someone to be asked to scroll
 * past a list of strangers' names first. Taking an existing slot is a single
 * tap below it, so someone who was pre-registered is one step from done.
 */
function IdentityStep({ players, code }: { players: Choice[]; code: string }) {
  return (
    <div className="space-y-6">
      <AddMe code={code} />

      {players.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" />
            or you&apos;re already on the list
            <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
          <PickSlot players={players} code={code} />
        </div>
      )}
    </div>
  );
}

function AddMe({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinAction, {});

  return (
    <form action={action} className="space-y-3 rounded-2xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-5">
      <input type="hidden" name="code" value={code} />
      <label className="block space-y-1.5">
        <span className="text-base font-bold">Add yourself</span>
        <input
          name="newName"
          required
          autoFocus
          maxLength={24}
          autoComplete="given-name"
          placeholder="Your name"
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-3 text-lg outline-none focus:border-[var(--color-clay)]"
        />
        <span className="block text-xs text-[var(--color-muted)]">
          However the group knows you — this is the name on the record.
        </span>
      </label>

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Joining…" : "Join the group"}
      </button>
    </form>
  );
}

/** One tap per slot: the button is the form's submit, carrying the player id. */
function PickSlot({ players, code }: { players: Choice[]; code: string }) {
  const [state, action, pending] = useActionState(joinAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <p className="text-xs text-[var(--color-muted)]">
        Tap your name. Slots like &ldquo;A&rdquo; or &ldquo;B&rdquo; are placeholders — you can put
        your real name on yours straight after.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            name="playerId"
            value={p.id}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-left text-sm font-semibold hover:border-[var(--color-clay)] disabled:opacity-50"
          >
            <span aria-hidden>{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>
      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}
    </form>
  );
}
