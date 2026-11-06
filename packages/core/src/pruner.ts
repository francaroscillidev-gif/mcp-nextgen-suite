/**
 * Token budget guard & compact serialization.
 * Prevents massive payloads from blowing up context windows or incurring runaway costs.
 */

export interface BudgetOptions {
  maxCharacters?: number; // Approximate token limiter (e.g. 4000 chars ~ 1000 tokens)
  maxLines?: number;
  truncationMessage?: string;
}

export function pruneContext(text: string, options: BudgetOptions = {}): { text: string; truncated: boolean; originalLength: number } {
  const maxCharacters = options.maxCharacters ?? 16000; // ~4000 tokens default limit
  const maxLines = options.maxLines ?? 250;
  const originalLength = text.length;

  let truncated = false;
  let lines = text.split('\n');

  if (lines.length > maxLines) {
    // Keep first 20% and last 80% of allowed lines for crash logs (often head has context, tail has stacktrace)
    const headCount = Math.floor(maxLines * 0.2);
    const tailCount = maxLines - headCount;
    const omittedCount = lines.length - maxLines;
    lines = [
      ...lines.slice(0, headCount),
      `\n... [TRUNCATED ${omittedCount} intermediate lines for context economy] ...\n`,
      ...lines.slice(lines.length - tailCount)
    ];
    truncated = true;
  }

  let joined = lines.join('\n');
  if (joined.length > maxCharacters) {
    const headChars = Math.floor(maxCharacters * 0.2);
    const tailChars = maxCharacters - headChars;
    joined = `${joined.slice(0, headChars)}\n\n[... TRUNCATED due to character budget (${originalLength} chars total) ...]\n\n${joined.slice(joined.length - tailChars)}`;
    truncated = true;
  }

  return {
    text: joined,
    truncated,
    originalLength
  };
}

export function formatCompactJson(obj: unknown, maxChars = 8000): string {
  const jsonStr = JSON.stringify(obj, null, 2);
  const { text } = pruneContext(jsonStr, { maxCharacters: maxChars });
  return text;
}
