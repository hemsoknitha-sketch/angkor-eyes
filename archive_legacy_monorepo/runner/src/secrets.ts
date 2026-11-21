/**
 * secrets.ts — Secrets Vault client (ANGKOR EYES runner).
 * RULE: agents NEVER see .env files, SSH keys, or DB passwords.
 * Secrets are injected ONLY when a task explicitly needs them, as
 * environment variables passed to the sandboxed process — never written
 * to disk inside a worktree, never echoed to logs, never sent to an LLM.
 *
 * Sources (in order): (1) OS keychain via `security`/`secret-tool` if
 * available, (2) a Vault HTTP endpoint (VAULT_ADDR + VAULT_TOKEN),
 * (3) process env passthrough for explicitly allowlisted names only.
 * No invented tokens: if nothing is configured, injection is refused.
 */
import { execFile } from "child_process";
import * as os from "os";

export const SECRET_ALLOWLIST = new Set([
  "TELEGRAM_BOT_TOKEN", "GITHUB_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
  "DATABASE_URL", "REDIS_URL", "NPM_TOKEN",
]);

export interface SecretRequest { name: string; taskId: string; agentRole: string; }

export class SecretsVault {
  private vaultAddr = process.env.VAULT_ADDR ?? "";
  private vaultToken = process.env.VAULT_TOKEN ?? "";

  /** Fetch one secret by name. Returns undefined when unavailable/refused. */
  async getSecret(req: SecretRequest): Promise<string | undefined> {
    if (!SECRET_ALLOWLIST.has(req.name)) return undefined; // deny by default
    // 1) OS keychain (macOS `security`, Linux `secret-tool`)
    const fromKeychain = await this.fromKeychain(req.name);
    if (fromKeychain) return fromKeychain;
    // 2) Vault HTTP endpoint (HashiCorp Vault KV v2 shape)
    if (this.vaultAddr && this.vaultToken) {
      try {
        const res = await fetch(`${this.vaultAddr.replace(/\/$/, "")}/v1/kv/data/angkor-eyes/${req.name.toLowerCase()}`, {
          headers: { "X-Vault-Token": this.vaultToken },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const body = await res.json() as { data?: { data?: { value?: string } } };
          return body.data?.data?.value;
        }
      } catch { /* fall through */ }
    }
    // 3) Env passthrough — only allowlisted names, only from the runner's own env.
    const v = process.env[req.name];
    return v && v.length > 0 ? v : undefined;
  }

  /** Inject secrets as env vars for a sandboxed child process. Never writes to disk. */
  async injectEnv(names: string[], req: Omit<SecretRequest, "name">): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    for (const name of names) {
      const value = await this.getSecret({ name, ...req });
      if (value) env[name] = value;
    }
    return env;
  }

  /** Refuse to expose a secret file path to an agent. Agents get env only. */
  assertNoSecretFileAccess(p: string): void {
    const base = pathBasename(p);
    if (/^\.env(\.|$)/.test(base) || base.endsWith(".pem") || base.endsWith(".key") ||
        base === "id_ed25519" || base === "id_rsa" || base.includes("credentials")) {
      throw new Error(`Secret file access denied: ${base}`);
    }
  }

  private fromKeychain(name: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const cmd = os.platform() === "darwin" ? "security" : "secret-tool";
      const args = os.platform() === "darwin"
        ? ["find-generic-password", "-s", `angkor-eyes-${name.toLowerCase()}`, "-w"]
        : ["lookup", "service", "angkor-eyes", "key", name.toLowerCase()];
      execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
        if (err) return resolve(undefined);
        const v = stdout.trim();
        resolve(v ? v : undefined);
      });
    });
  }
}

function pathBasename(p: string): string { return p.split("/").pop() ?? p; }
