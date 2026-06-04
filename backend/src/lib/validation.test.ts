import { isValidUUID, isValidDate } from './validation';

describe('isValidUUID', () => {
  it('returns true for a valid lowercase UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for a valid uppercase UUID', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('returns false for a UUID missing a segment', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });
});

describe('isValidDate', () => {
  it('returns true for an ISO date string', () => {
    expect(isValidDate('2024-06-01T10:00:00Z')).toBe(true);
  });

  it('returns true for a date-only string', () => {
    expect(isValidDate('2024-06-01')).toBe(true);
  });

  it('returns false for a garbage string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidDate('')).toBe(false);
  });
});
