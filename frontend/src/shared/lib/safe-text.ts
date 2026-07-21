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
