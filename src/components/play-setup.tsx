import { PLAYDAY_SQL, SQL_EDITOR_URL } from "@/lib/playday-sql";
import { CopyBlock } from "./copy-block";

/**
 * Shown instead of the play-day screens until the table exists. The people
 * who see this are the group, not a developer, so it says what to do in order.
 */
export function PlaySetup() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">One quick setup step</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Play days need one new table in the database. It&apos;s a single paste, and it only has to
          happen once. Whoever runs the Supabase project does it:
        </p>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>
          Open the{" "}
          <a
            href={SQL_EDITOR_URL}
            target="_blank"
            rel="noopener"
            className="font-semibold text-[var(--color-clay)] underline"
          >
            Supabase SQL editor
          </a>
          .
        </li>
        <li>Copy the SQL below and paste it in.</li>
        <li>
          Press <strong>Run</strong>, then reload this page.
        </li>
      </ol>

      <CopyBlock text={PLAYDAY_SQL} />
    </div>
  );
}
