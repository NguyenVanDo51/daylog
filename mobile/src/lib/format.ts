export function formatVnMonth(d: Date): string {
  return `Tháng ${d.getMonth() + 1}`;
}

export function formatVnDate(d: Date): string {
  return `${d.getDate()} Th${d.getMonth() + 1}`;
}

export function formatVnAge(birthdate: string | null, now: Date = new Date()): string {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 24) return `${months} tháng tuổi`;
  return `${Math.floor(months / 12)} tuổi`;
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Chào buổi sáng';
  if (hour >= 11 && hour < 13) return 'Chào buổi trưa';
  if (hour >= 13 && hour < 18) return 'Chào buổi chiều';
  if (hour >= 18 && hour < 22) return 'Chào buổi tối';
  return 'Chào buổi khuya';
}
