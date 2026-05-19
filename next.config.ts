import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_BRANCH: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
  },
};

export default nextConfig;
