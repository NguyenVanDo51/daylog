import { toDateKey, addDays, isToday } from './dateKey';

describe('dateKey', () => {
  it('toDateKey formats YYYY-MM-DD', () => {
    expect(toDateKey(new Date('2026-06-04T12:00:00Z'))).toBe('2026-06-04');
    expect(toDateKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });

  it('addDays adds or subtracts days', () => {
    expect(addDays('2026-06-04', 1)).toBe('2026-06-05');
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('isToday', () => {
    const now = new Date();
    const key = toDateKey(now);
    expect(isToday(key)).toBe(true);
    expect(isToday(addDays(key, -1))).toBe(false);
    expect(isToday(addDays(key, 1))).toBe(false);
  });
});
