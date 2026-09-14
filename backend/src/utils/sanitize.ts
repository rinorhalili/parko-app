export function sanitizeText(value: string, maxLength = 2_000) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeOptionalText(value: unknown, maxLength?: number) {
  return typeof value === "string" ? sanitizeText(value, maxLength) : undefined;
}
