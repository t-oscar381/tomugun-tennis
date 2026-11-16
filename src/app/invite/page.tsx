import Link from "next/link";
import { redirect } from "next/navigation";
import { inviteUrl } from "@/lib/league";
import { getSession } from "@/lib/session";
import { Qr } from "@/components/qr";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite" };

/**
 * The page you hold up.
 *
 * Everyone is on a phone, standing by one court. Reading a link out loud is
 * hopeless and the group chat is three scrolls away, so this is a QR code big
 * enough to scan at arm's length, with the code underneath for anyone whose
 * camera won't cooperate. Signed-in only: the code belongs to the group.
 */
export default async function InvitePage() {
  const session = await getSession();
  if (!session) redirect("/join?next=%2Finvite");

  const { group } = session;
  const url = inviteUrl(group.join_code);
  const message = `Join ${group.name} 🎾\n\nAdd your name and log who wins:\n${url}`;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <section className="overflow-hidden rounded-3xl bg-court-deep text-center text-white shadow-[0_24px_48px_-28px_rgb(6_42_32/0.7)]">
        <div className="px-6 pt-8">
          <p className="eyebrow text-lime">Scan to join</p>
          <h1 className="mt-2 text-3xl leading-tight">{group.name}</h1>
          <p className="mt-2 text-sm text-white/75">
            Point a phone camera at this. It opens the group&apos;s sign-in page — they add their
            name and they&apos;re in.
          </p>
        </div>

        <div className="p-6">
          <div className="mx-auto max-w-[18rem] overflow-hidden rounded-2xl bg-white p-2">
            <Qr value={url} className="block w-full" />
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/15 px-6 py-5">
          <p className="eyebrow text-white/60">Or type the group code</p>
          <p className="nums mt-1 break-all text-2xl font-bold tracking-[0.2em] text-lime">{group.join_code}</p>
          <p className="mt-1 text-xs text-white/60">at play-tennis.tomugun.com/join</p>
        </div>
      </section>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener"
        className="btn w-full bg-win text-white"
      >
        Send the link on WhatsApp
      </a>

      <p className="text-center text-xs text-muted">
        Anyone with this code can join, so keep it to the group.{" "}
        <Link href="/" className="font-semibold text-clay underline">
          Back to the scoreboard
        </Link>
      </p>
    </div>
  );
}
