/**
 * Production build wrapper.
 *
 * Next loads `.env.local` on every build, and OpenNext snapshots whatever it
 * loaded into `.open-next/cloudflare/next-env.mjs` as a runtime fallback. That
 * means a production build run on a dev machine bakes the dev secrets —
 * including SUPABASE_SERVICE_ROLE_KEY — into the deployed Worker bundle in
 * plaintext. The Worker doesn't need them there: Cloudflare's own vars and
 * Secrets take precedence at runtime (see .open-next/cloudflare/init.js, which
 * assigns the Worker env first and only fills gaps with the snapshot).
 *
 * So we move `.env.local` aside for the duration of the build. CI builds have
 * no `.env.local` at all, so this is a no-op there and local builds match what
 * CI produces.
 */

import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const ENV = ".env.local";
const HIDDEN = ".env.local.build-hidden";

const hide = existsSync(ENV);
let restored = false;

function restore() {
  if (restored || !hide) return;
  if (existsSync(HIDDEN)) renameSync(HIDDEN, ENV);
  restored = true;
}

// Restore even if the build is interrupted, so nobody is left without their
// local env after a Ctrl-C.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => {
  restore();
  process.exit(1);
});
process.on("exit", restore);

if (hide) renameSync(ENV, HIDDEN);

const result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

restore();
process.exit(result.status ?? 1);
