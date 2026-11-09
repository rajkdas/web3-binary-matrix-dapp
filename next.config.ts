import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Ensure the Solidity sources (contract viewer) and the Prisma query
     engine are traced into serverless bundles when deploying to Vercel. */
  outputFileTracingIncludes: {
    "/api/contracts": ["./contracts/**/*"],
    "/api/**": ["./node_modules/.prisma/**/*", "./node_modules/@prisma/client/**/*"],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
