import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🎾
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Out.</h1>
      <p className="mt-2 text-muted">
        That page isn&apos;t here. The player may have left the group, or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-clay px-5 py-3 font-bold text-white"
      >
        Back to the scoreboard
      </Link>
    </div>
  );
}
