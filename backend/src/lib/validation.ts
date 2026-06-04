export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(s: string): boolean {
  return UUID_RE.test(s);
}

export function isValidDate(s: string): boolean {
  if (!s) return false;
  return !isNaN(new Date(s).getTime());
}
