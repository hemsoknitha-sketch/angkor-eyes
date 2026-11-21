export class SecretRedactor {
  private static patterns = [
    { name: 'API_KEY_GENERIC', regex: /(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi },
    { name: 'OPENAI_KEY', regex: /sk-(?:proj-)?[a-zA-Z0-9_\-]{20,}/g },
    { name: 'ANTHROPIC_KEY', regex: /sk-ant-[a-zA-Z0-9_\-]{20,}/g },
    { name: 'GEMINI_KEY', regex: /AIzaSy[a-zA-Z0-9_\-]{20,40}/g },
    { name: 'GITHUB_TOKEN', regex: /gh[pousr]_[a-zA-Z0-9]{36,}/g },
    { name: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
    { name: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g },
    { name: 'POSTGRES_URI', regex: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^?\s]+/gi }
  ];

  public static redact(text: string): { cleanText: string; secretsFoundCount: number } {
    if (!text || typeof text !== 'string') return { cleanText: text, secretsFoundCount: 0 };
    let cleanText = text;
    let secretsFoundCount = 0;

    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      cleanText = cleanText.replace(regex, () => {
        secretsFoundCount++;
        return `[REDACTED_${pattern.name}]`;
      });
    }

    return { cleanText, secretsFoundCount };
  }
}
