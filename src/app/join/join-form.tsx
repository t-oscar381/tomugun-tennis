"use client";

import { useActionState } from "react";
import { joinAction } from "../actions";
import { Avatar } from "@/components/avatar";

interface Choice {
  id: string;
  name: string;
}

export function JoinForm({
  players,
  unlocked,
  wrongCode,
  code,
  next,
}: {
  players: Choice[];
  unlocked: boolean;
  wrongCode: boolean;
  code: string;
  next: string;
}) {
  if (!unlocked) return <CodeStep wrongCode={wrongCode} next={next} />;
  return <IdentityStep players={players} code={code} next={next} />;
}

/**
 * Step one. A plain GET form, so it works with no JavaScript and leaves the
 * code in the URL — which is what makes an invite link possible.
 *
 * No placeholder here on purpose: it used to show the real code, which was the
 * actual live code printed on the page.
 */
function CodeStep({ wrongCode, next }: { wrongCode: boolean; next: string }) {
  return (
    <form method="get" action="/join" className="space-y-4">
      {next !== "/" && <input type="hidden" name="next" value={next} />}
      <label className="block space-y-1.5">
        <span className="eyebrow text-muted">Group code</span>
        <input
          name="c"
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={wrongCode || undefined}
          className="nums w-full rounded-xl border border-line bg-bg px-4 py-3.5 text-center text-2xl font-semibold uppercase tracking-[0.3em] outline-none focus:border-clay"
        />
      </label>

      {wrongCode && (
        <p className="text-sm text-loss">
          That code isn&apos;t right. Ask whoever sent you the link.
        </p>
      )}

      <button className="btn btn-clay w-full">
        Continue <span aria-hidden>→</span>
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
function IdentityStep({ players, code, next }: { players: Choice[]; code: string; next: string }) {
  return (
    <div className="space-y-6">
      <AddMe code={code} next={next} />

      {players.length > 0 && (
        <div className="space-y-3">
          <div className="eyebrow flex items-center gap-3 text-muted">
            <span className="h-px flex-1 bg-line" />
            or you&apos;re already on the list
            <span className="h-px flex-1 bg-line" />
          </div>
          <PickSlot players={players} code={code} next={next} />
        </div>
      )}
    </div>
  );
}

function AddMe({ code, next }: { code: string; next: string }) {
  const [state, action, pending] = useActionState(joinAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1.5">
        <span className="eyebrow text-muted">Add yourself</span>
        <input
          name="newName"
          required
          autoFocus
          maxLength={24}
          autoComplete="given-name"
          placeholder="Your name"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3.5 text-lg outline-none focus:border-clay"
        />
        <span className="block text-xs text-muted">
          However the group knows you — this is the name on the record.
        </span>
      </label>

      {state.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        disabled={pending}
        className="btn btn-clay w-full disabled:opacity-40"
      >
        {pending ? "Joining…" : "Join the group"}
      </button>
    </form>
  );
}

/** One tap per slot: the button is the form's submit, carrying the player id. */
function PickSlot({ players, code, next }: { players: Choice[]; code: string; next: string }) {
  const [state, action, pending] = useActionState(joinAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="next" value={next} />
      <p className="text-xs text-muted">Tap your name to sign in as you.</p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            name="playerId"
            value={p.id}
            disabled={pending}
            className="flex min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 text-left text-sm font-semibold transition-colors hover:border-clay hover:bg-clay-soft/60 disabled:opacity-50"
          >
            <Avatar id={p.id} name={p.name} size={32} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>
      {state.error && <p className="text-sm text-loss">{state.error}</p>}
    </form>
  );
}
