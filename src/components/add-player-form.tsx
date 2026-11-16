"use client";

import { useActionState } from "react";
import { addPlayerAction } from "@/app/actions";

/**
 * Add somebody to the group. The pool is bigger than any one night, and the
 * eighth person turns up eventually — they should not have to wait for the
 * link to be re-sent.
 */
export function AddPlayerForm({ label = "Add a player" }: { label?: string }) {
  const [state, action, pending] = useActionState(addPlayerAction, {});

  return (
    <form action={action} className="space-y-2">
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
            className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2.5 outline-none focus:border-clay"
          />
          <button
            disabled={pending}
            className="rounded-full border border-clay px-5 py-2.5 font-bold text-clay disabled:opacity-40"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </label>
      {state.error && <p className="text-sm text-loss">{state.error}</p>}
      {state.ok && <p className="text-sm text-win">{state.ok}</p>}
    </form>
  );
}
