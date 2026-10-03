import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // A lockfile in the parent Documents folder otherwise becomes the Turbopack root,
  // and nested dashboard routes 404 in development.
  turbopack: {
    root: path.join(process.cwd()),
  },
};

export default nextConfig;
