import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project sits inside a larger workspace; without this Next walks up
  // and picks the wrong root because of a parent lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
