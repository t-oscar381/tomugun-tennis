"use client";

import { useActionState, useState } from "react";
import { startPlayDayAction } from "@/app/actions";

interface Person {
  id: string;
  name: string;
  emoji: string;
}

/**
 * Who turned up, and on what date.
 *
 * Starts from the last play day's attendees: a weekly group is mostly the same
 * five or six people, so "who's here" is usually a tick or two away from done.
 */
export function StartPlayDay({
  players,
  defaultDate,
  defaultIds,
  maxDate,
}: {
  players: Person[];
  defaultDate: string;
  defaultIds: string[];
  maxDate: string;
}) {
  const [state, action, pending] = useActionState(startPlayDayAction, {});
  const [picked, setPicked] = useState<Set<string>>(new Set(defaultIds));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Date</span>
        <input
          type="date"
          name="date"
          required
          defaultValue={defaultDate}
          max={maxDate}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5 outline-none focus:border-[var(--color-clay)]"
        />
        <span className="block text-xs text-[var(--color-muted)]">
          Playing today? Leave it. Logging last night&apos;s games? Change it.
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Who&apos;s here?{" "}
          <span className="nums font-normal text-[var(--color-muted)]">{picked.size} ticked</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const on = picked.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                  on
                    ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white"
                    : "border-[var(--color-line)] text-[var(--color-muted)]"
                }`}
              >
                <input
                  type="checkbox"
                  name="attendee"
                  value={p.id}
                  checked={on}
                  onChange={() => toggle(p.id)}
                  className="sr-only"
                />
                <span aria-hidden>{p.emoji}</span>
                {p.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending || picked.size < 2}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Starting…" : picked.size < 2 ? "Tick at least two people" : "Start the play day"}
      </button>
    </form>
  );
}
