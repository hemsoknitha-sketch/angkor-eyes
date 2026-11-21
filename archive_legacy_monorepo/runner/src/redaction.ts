/**
 * redaction.ts — PII / secret redaction before any text leaves the runner
 * toward an LLM or the backend log stream.
 * Layers: (1) regex patterns loaded from ../security/redaction-patterns.json
 * when present, else built-ins; (2) Shannon-entropy detector for
 * high-entropy tokens (likely API keys/tokens).
 * NEVER log or transmit the matched secret itself — replace with a label.
 */
import * as fs from "fs";
import * as path from "path";

export interface RedactionPattern { name: string; regex: string; replacement: string; }

const BUILTIN_PATTERNS: RedactionPattern[] = [
  { name: "telegram_bot_token", regex: "\\b\\d{8,10}:[A-Za-z0-9_-]{35}\\b", replacement: "[REDACTED:TELEGRAM_TOKEN]" },
  { name: "github_pat", regex: "\\bgh[pousr]_[A-Za-z0-9]{36,255}\\b", replacement: "[REDACTED:GITHUB_TOKEN]" },
  { name: "aws_access_key", regex: "\\bAKIA[0-9A-Z]{16}\\b", replacement: "[REDACTED:AWS_KEY]" },
  { name: "anthropic_key", regex: "\\bsk-ant-[A-Za-z0-9_-]{20,}\\b", replacement: "[REDACTED:ANTHROPIC_KEY]" },
  { name: "openai_key", regex: "\\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\\b", replacement: "[REDACTED:OPENAI_KEY]" },
  { name: "private_key_block", regex: "-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\\s\\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", replacement: "[REDACTED:PRIVATE_KEY]" },
  { name: "bearer_token", regex: "\\bBearer\\s+[A-Za-z0-9._~+/=-]{20,}\\b", replacement: "Bearer [REDACTED]" },
  { name: "password_assignment", regex: "(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\\s*[:=]\\s*['\"][^'\"]+['\"]", replacement: "$1=[REDACTED]" },
  { name: "env_assignment", regex: "(?i)^\\s*(?:export\\s+)?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\\s*=\\s*.+$", replacement: "[REDACTED:ENV_SECRET]" },
  { name: "email", regex: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b", replacement: "[REDACTED:EMAIL]" },
  { name: "khmer_phone", regex: "\\b(?:\\+855|0)(?:1[0-9]|2[0-9]|3[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\\d{6,7}\\b", replacement: "[REDACTED:PHONE]" },
  { name: "jwt", regex: "\\beyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b", replacement: "[REDACTED:JWT]" },
];

export function loadPatterns(): RedactionPattern[] {
  const candidates = [
    path.join(__dirname, "..", "..", "security", "redaction-patterns.json"),
    path.join(process.cwd(), "..", "security", "redaction-patterns.json"),
    path.join(process.cwd(), "security", "redaction-patterns.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { patterns?: RedactionPattern[] };
      if (raw.patterns?.length) return raw.patterns;
    } catch { /* fall through to built-ins */ }
  }
  return BUILTIN_PATTERNS;
}

/** Shannon entropy of a string (bits per char). High entropy + length => likely a secret. */
export function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

export function looksLikeSecret(token: string): boolean {
  if (token.length < 20) return false;
  // Long token with mixed classes and high entropy.
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(token)).length;
  return classes >= 3 && shannonEntropy(token) >= 4.0;
}

export class Redactor {
  private patterns: { name: string; re: RegExp; replacement: string }[];
  private redactionCount = 0;

  constructor(patterns: RedactionPattern[] = loadPatterns()) {
    // JS RegExp has no (?i) inline flag: strip a leading (?i) and add the "i" flag instead.
    this.patterns = patterns.map((p) => {
      let src = p.regex;
      let flags = "gm";
      if (src.startsWith("(?i)")) { src = src.slice(4); flags = "gim"; }
      return { name: p.name, re: new RegExp(src, flags), replacement: p.replacement };
    });
  }

  redact(text: string): string {
    let out = text;
    for (const p of this.patterns) {
      const before = out;
      out = out.replace(p.re, p.replacement);
      if (out !== before) this.redactionCount++;
    }
    // Entropy pass: mask long high-entropy bare tokens (not in URLs/paths).
    out = out.replace(/\b[A-Za-z0-9_\-+/=]{24,}\b/g, (tok) =>
      looksLikeSecret(tok) ? "[REDACTED:HIGH_ENTROPY]" : tok);
    return out;
  }

  get count(): number { return this.redactionCount; }
}
