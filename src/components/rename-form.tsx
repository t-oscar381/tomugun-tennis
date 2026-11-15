"use client";

import { useActionState } from "react";
import { renameAction } from "@/app/actions";

/** Change your own name. The roster starts as A, B, C… and people replace them. */
export function RenameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(renameAction, {});
  return (
    <form action={action} className="space-y-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your name</span>
        <div className="flex gap-2">
          <input
            name="name"
            required
            maxLength={24}
            defaultValue={current.length === 1 ? "" : current}
            placeholder="However the group knows you"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 outline-none focus:border-[var(--color-clay)]"
          />
          <button
            disabled={pending}
            className="rounded-lg bg-[var(--color-clay)] px-4 py-2.5 font-bold text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </label>
      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}
    </form>
  );
}
