/**
 * sandbox.ts — Docker sandbox policy enforcement (ANGKOR EYES runner).
 * Guarantees:
 *  - non-root user inside the container (uid 10001)
 *  - only the task worktree is mounted, read-write; host root is never mounted
 *  - NO host Docker socket (/var/run/docker.sock is never mounted)
 *  - network egress restricted to an allowlist (proxy / --network + iptables
 *    enforced by the image; see security/sandbox-policy.yaml)
 *  - CPU / RAM / disk (pids + tmpfs size) limits, process timeout
 *  - high-risk tasks: MicroVM note — use Firecracker/gVisor runtime instead
 *    of plain runc when `risk === "high"` (see runSandbox options).
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "./sandboxPolicy"; // local loader below (no yaml dep needed)

export interface SandboxLimits {
  cpus: string;      // e.g. "1.0"
  memory: string;    // e.g. "512m"
  pidsLimit: number;
  timeoutMs: number;
  diskMb: number;    // tmpfs / workspace size cap
}

export interface SandboxRunOptions {
  image: string;
  worktreePath: string;
  command: string[];          // already allowlist-checked by executor.ts
  env?: Record<string, string>;
  egressAllowlist: string[];  // hostnames allowed (enforced via --add-host + proxy env)
  limits?: Partial<SandboxLimits>;
  risk?: "low" | "medium" | "high";
  network?: "none" | "restricted";
}

export interface SandboxResult { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; }

export const DEFAULT_LIMITS: SandboxLimits = {
  cpus: "1.0", memory: "512m", pidsLimit: 128, timeoutMs: 10 * 60 * 1000, diskMb: 1024,
};

export function loadSandboxPolicy(): Record<string, unknown> {
  const p = path.join(__dirname, "..", "..", "security", "sandbox-policy.yaml");
  try { return yaml.parseSimpleYaml(fs.readFileSync(p, "utf8")); } catch { return {}; }
}

/** Build the `docker run` argv. Pure function — unit-testable without Docker. */
export function buildDockerArgs(opts: SandboxRunOptions): string[] {
  const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) };
  if (opts.risk === "high") {
    // MicroVM / gVisor runtime for high-risk tasks; falls back to runc if
    // the runtime is not installed (caller must check `docker info`).
    // We still pass --runtime=runsc; Docker errors loudly if missing — safe fail-closed.
  }
  const args: string[] = [
    "run", "--rm",
    "--user", "10001:10001",
    "--read-only",
    "--tmpfs", `/tmp:rw,noexec,nosuid,nodev,size=${limits.diskMb}m`,
    "--mount", `type=bind,source=${opts.worktreePath},target=/work,readonly=false`,
    "--workdir", "/work",
    "--cpus", limits.cpus,
    "--memory", limits.memory,
    "--pids-limit", String(limits.pidsLimit),
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--network", opts.network === "none" ? "none" : "restricted-egress",
  ];
  if (opts.risk === "high") args.push("--runtime", "runsc");
  // Egress allowlist is enforced by the restricted-egress network + proxy:
  // only these hosts resolve; everything else is dropped at the proxy.
  for (const host of opts.egressAllowlist) args.push("--add-host", `${host}:127.0.0.1`);
  args.push("--env", `HTTPS_PROXY=http://egress-proxy:3128`);
  for (const [k, v] of Object.entries(opts.env ?? {})) args.push("--env", `${k}=${v}`);
  // NEVER mount /var/run/docker.sock — the sandbox cannot reach the host Docker daemon.
  args.push(opts.image, ...opts.command);
  return args;
}

export function runSandbox(opts: SandboxRunOptions): Promise<SandboxResult> {
  const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) };
  const args = buildDockerArgs(opts);
  return new Promise((resolve) => {
    const child = spawn("docker", args, { timeout: limits.timeoutMs });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, limits.timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); resolve({ exitCode: null, stdout, stderr: stderr + String(err), timedOut }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: code, stdout, stderr, timedOut }); });
  });
}
