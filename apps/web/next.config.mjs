import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"));
const appVersion = rootPackageJson.version ?? "0.1.0";
const deploymentId =
  process.env.CAPRIS_DEPLOYMENT_ID?.trim() ||
  process.env.RAILWAY_DEPLOYMENT_ID?.trim() ||
  process.env.RAILWAY_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
  process.env.SOURCE_VERSION?.trim()?.slice(0, 7) ||
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
const deployedAt = new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_DEPLOYMENT_ID: deploymentId,
    NEXT_PUBLIC_APP_DEPLOYED_AT: deployedAt
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@capris/shared"]
};

export default nextConfig;
