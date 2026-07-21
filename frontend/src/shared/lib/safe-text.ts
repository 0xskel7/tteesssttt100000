/**
 * CWE-79: neutralize untrusted flight strings before display/labels.
 * React text nodes already escape HTML — this strips control/markup leftovers.
 */
export function safeDisplayText(
  input: string | null | undefined,
  maxLen = 80,
): string {
  if (!input) return "—";
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, maxLen) || "—";
}
