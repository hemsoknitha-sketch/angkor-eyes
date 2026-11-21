/**
 * sandboxPolicy.ts — tiny YAML subset parser (no external dep).
 * Only handles the flat `key: value` / list shapes in security/sandbox-policy.yaml.
 * For full YAML, install `yaml` and replace this loader.
 */
export function parseSimpleYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let currentKey = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentKey) {
      const arr = (out[currentKey] as string[]) ?? [];
      arr.push(listMatch[1].trim());
      out[currentKey] = arr;
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (kv) { currentKey = kv[1]; out[currentKey] = kv[2].trim() || {}; }
  }
  return out;
}
