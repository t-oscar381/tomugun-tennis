"use client";

import { useActionState, useState } from "react";
import { joinAction } from "../actions";

interface Choice {
  id: string;
  name: string;
  emoji: string;
}

export function JoinForm({ players }: { players: Choice[] }) {
  const [state, action, pending] = useActionState(joinAction, {});
  const [selected, setSelected] = useState<string>("");
  const [creating, setCreating] = useState(players.length === 0);

  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Group code</span>
        <input
          name="code"
          required
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="DEUCE"
          className="nums w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 uppercase tracking-widest outline-none focus:border-[var(--color-clay)]"
        />
      </label>

      {!creating && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Who are you?</legend>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  selected === p.id
                    ? "border-[var(--color-clay)] bg-[var(--color-clay)]/10"
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
            I&apos;m new — add me
          </button>
        </fieldset>
      )}

      {creating && (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Your name</span>
          <input
            name="newName"
            maxLength={24}
            placeholder="Andre"
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 outline-none focus:border-[var(--color-clay)]"
          />
          {players.length > 0 && (
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-[var(--color-muted)] underline"
            >
              Actually, I&apos;m already on the list
            </button>
          )}
        </label>
      )}

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-[var(--color-clay)] px-4 py-3 font-bold text-[var(--color-bg)] disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter the league"}
      </button>
    </form>
  );
}
