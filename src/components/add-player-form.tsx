"use client";

import { useActionState } from "react";
import { addPlayerAction } from "@/app/actions";

/**
 * Add somebody to the group. The pool is bigger than any one night, and the
 * eighth person turns up eventually — they should not have to wait for the
 * link to be re-sent. From a play day it also marks them as here.
 */
export function AddPlayerForm({ sessionId, label = "Add a player" }: { sessionId?: string; label?: string }) {
  const [state, action, pending] = useActionState(addPlayerAction, {});

  return (
    <form action={action} className="space-y-2">
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex gap-2">
          {/* The key changes on each success, which empties the box for the next name. */}
          <input
            key={state.stamp ?? 0}
            name="name"
            required
            maxLength={24}
            autoComplete="off"
            placeholder="Their name"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 outline-none focus:border-[var(--color-clay)]"
          />
          <button
            disabled={pending}
            className="rounded-lg border border-[var(--color-clay)] px-4 py-2.5 font-bold text-[var(--color-clay)] disabled:opacity-40"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </label>
      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}
      {state.ok && <p className="text-sm text-[var(--color-win)]">{state.ok}</p>}
    </form>
  );
}
