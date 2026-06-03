import { formatVnMonth, formatVnDate, formatVnAge, greetingForHour } from '../format';

describe('formatVnMonth', () => {
  it('returns "Tháng N" with no leading zero', () => {
    expect(formatVnMonth(new Date('2024-10-15'))).toBe('Tháng 10');
    expect(formatVnMonth(new Date('2024-01-01'))).toBe('Tháng 1');
  });
});

describe('formatVnDate', () => {
  it('returns "D ThM" form', () => {
    expect(formatVnDate(new Date('2024-10-12'))).toBe('12 Th10');
    expect(formatVnDate(new Date('2024-03-05'))).toBe('5 Th3');
  });
});

describe('formatVnAge', () => {
  it('uses tháng under 24 months', () => {
    const birth = '2024-01-01';
    const today = new Date('2024-08-15');
    expect(formatVnAge(birth, today)).toBe('7 tháng tuổi');
  });
  it('uses tuổi at or above 2 years', () => {
    const birth = '2022-01-01';
    const today = new Date('2024-08-15');
    expect(formatVnAge(birth, today)).toBe('2 tuổi');
  });
  it('returns empty string when birthdate is null', () => {
    expect(formatVnAge(null, new Date())).toBe('');
  });
});

describe('greetingForHour', () => {
  it('maps hour ranges correctly', () => {
    expect(greetingForHour(6)).toBe('Chào buổi sáng');
    expect(greetingForHour(12)).toBe('Chào buổi trưa');
    expect(greetingForHour(15)).toBe('Chào buổi chiều');
    expect(greetingForHour(20)).toBe('Chào buổi tối');
    expect(greetingForHour(23)).toBe('Chào buổi khuya');
    expect(greetingForHour(3)).toBe('Chào buổi khuya');
  });
});
