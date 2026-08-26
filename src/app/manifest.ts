import type { MetadataRoute } from "next";

/**
 * Installable to the home screen. This is a phone-first app used courtside,
 * where opening a browser and finding a tab is friction; "add to home screen"
 * makes it behave like the native apps it's competing with.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tomugun Tennis",
    short_name: "Tennis",
    description: "Log a friendly match, climb a ranked ladder.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#f5f7f3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
