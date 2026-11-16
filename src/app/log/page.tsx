import { redirect } from "next/navigation";

/**
 * Logging lives on the day's page now. This path survives only because links to
 * it exist: the old home button, the nav, anything bookmarked.
 */
export default function LogPage() {
  redirect("/play");
}
