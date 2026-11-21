#!/usr/bin/env node
/**
 * index.ts — CLI entry for the ANGKOR EYES local runner.
 *
 * Usage:
 *   RUNNER_TOKEN=... BACKEND_WSS_URL=wss://backend.example.com/runner \
 *   REPO_PATH=/path/to/repo node dist/index.js
 *   node dist/index.js --help
 *
 * Security: outbound WSS only — the runner opens NO listening port.
 * Reach the backend via Cloudflare Tunnel or Tailscale (see README.md):
 *   - Cloudflare Tunnel: BACKEND_WSS_URL=wss://runner.<your-domain>/runner
 *   - Tailscale: BACKEND_WSS_URL=wss://<backend-tailscale-ip>:8443/runner
 * Never expose the backend or the runner directly to the public internet.
 */
import * as crypto from "crypto";
import { Runner } from "./runner";

function env(name: string, required = false): string {
  const v = process.env[name];
  if (required && !v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v ?? "";
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`angkor-runner — ANGKOR EYES local runner
Usage: RUNNER_TOKEN=... BACKEND_WSS_URL=wss://... REPO_PATH=... node dist/index.js
Env: RUNNER_TOKEN (required), BACKEND_WSS_URL (required),
     REPO_PATH (default: cwd), RUNNER_ID (default: runner-<random>),
     HEARTBEAT_MS (default 30000), LEASE_TIMEOUT_MS (default 90000)`);
  process.exit(0);
}

const runner = new Runner({
  backendWssUrl: env("BACKEND_WSS_URL", true),
  token: env("RUNNER_TOKEN", true),
  runnerId: process.env.RUNNER_ID ?? `runner-${crypto.randomBytes(4).toString("hex")}`,
  repoPath: process.env.REPO_PATH ?? process.cwd(),
  heartbeatMs: process.env.HEARTBEAT_MS ? parseInt(process.env.HEARTBEAT_MS, 10) : undefined,
  leaseTimeoutMs: process.env.LEASE_TIMEOUT_MS ? parseInt(process.env.LEASE_TIMEOUT_MS, 10) : undefined,
});

process.on("SIGINT", () => { runner.stop(); process.exit(0); });
process.on("SIGTERM", () => { runner.stop(); process.exit(0); });

runner.connect();
console.log("angkor-runner started (outbound WSS only, no open port).");
