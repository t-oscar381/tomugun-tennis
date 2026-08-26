/**
 * Skeleton for the dynamic pages.
 *
 * Everything is force-dynamic and does a database round trip before it can
 * render, so without this the app shows a blank frame on every navigation —
 * which on a phone reads as "it's broken", not "it's loading".
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[var(--color-surface)]"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}
