export function toDateKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return toDateKey(t);
}

export function isToday(key: string): boolean {
  return key === toDateKey(new Date());
}

export function isPast(key: string): boolean {
  return key < toDateKey(new Date());
}

export function isFuture(key: string): boolean {
  return key > toDateKey(new Date());
}
