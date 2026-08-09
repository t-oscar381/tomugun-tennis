import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Defaults are enough: every route here is dynamic (the ladder changes on
 * every confirmed match), so there is no ISR page cache to bind, and the app
 * uses no next/image. Revisit if either changes.
 */
export default defineCloudflareConfig();
