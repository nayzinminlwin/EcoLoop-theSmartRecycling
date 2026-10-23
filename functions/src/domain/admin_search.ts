// =============================================================================
// admin_search.ts — Normalized prefix token generator for Firestore array-contains search
// Phase AB-03 — Bounded prefix tokens for native Firestore search indexing
// =============================================================================

export interface TokenGeneratorOptions {
  readonly minPrefixLength?: number;
  readonly maxPrefixLength?: number;
  readonly maxTokensPerDoc?: number;
}

export function normalizeSearchString(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .trim();
}

export function generatePrefixTokens(
  sources: readonly (string | null | undefined)[],
  options?: TokenGeneratorOptions
): string[] {
  const minLen = options?.minPrefixLength ?? 2;
  const maxLen = options?.maxPrefixLength ?? 20;
  const maxTotal = options?.maxTokensPerDoc ?? 100;

  const tokenSet = new Set<string>();

  for (const source of sources) {
    if (!source || typeof source !== "string") continue;
    const normalized = normalizeSearchString(source);
    if (!normalized) continue;

    // Split on whitespace and common punctuation, while also keeping whole compound terms
    const rawTerms = normalized.split(/[^a-z0-9_-]+/).filter(Boolean);

    for (const term of rawTerms) {
      if (term.length < minLen) {
        if (term.length > 0) tokenSet.add(term);
        continue;
      }

      // Generate all prefixes from minLen up to min(term.length, maxLen)
      const upper = Math.min(term.length, maxLen);
      for (let len = minLen; len <= upper; len++) {
        tokenSet.add(term.slice(0, len));
        if (tokenSet.size >= maxTotal) break;
      }
      if (tokenSet.size >= maxTotal) break;
    }
    if (tokenSet.size >= maxTotal) break;
  }

  return Array.from(tokenSet);
}
