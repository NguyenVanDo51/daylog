export interface ReminderMessage {
  id: number;
  title: string;
  body: string;
}

const VI: ReminderMessage[] = [
  { id: 1,  title: 'Hôm nay đẹp ghê',         body: 'Có khoảnh khắc nào đáng giữ không?' },
  { id: 2,  title: 'Đôi khi chỉ cần 2 giây',  body: 'Bấm máy thử xem nào' },
  { id: 3,  title: '5 năm nữa nhìn lại…',     body: 'Bạn sẽ mừng vì có hôm nay' },
  { id: 4,  title: 'Còn thở là còn thương',   body: 'Lưu lại một khoảnh khắc nho nhỏ?' },
  { id: 5,  title: 'Bình thường thôi nhưng…', body: 'Ngày mai sẽ thành kỷ niệm' },
  { id: 6,  title: 'Có gì hay ho?',           body: 'Kể cho mình nghe bằng một tấm ảnh' },
  { id: 7,  title: 'Đời ngắn lắm',            body: 'Đừng để hôm nay trôi qua không dấu vết' },
  { id: 8,  title: '2 giây thôi',             body: "Quay 1 video ngắn cho 'mình ngày sau' xem" },
  { id: 9,  title: 'Bạn đang ở đâu giờ này?', body: 'Khoe một chút coi' },
  { id: 10, title: 'Một việc nhỏ',            body: 'Giữ lại khoảnh khắc này, mai sẽ thấy quý' },
];

const EN: ReminderMessage[] = [
  { id: 1,  title: 'Today looks lovely',       body: 'Anything worth saving right now?' },
  { id: 2,  title: 'Just two seconds',         body: 'Tap the shutter, see what you get' },
  { id: 3,  title: '5 years from now…',        body: "You'll thank yourself for today" },
  { id: 4,  title: "While you're here",        body: 'Hold on to a small moment?' },
  { id: 5,  title: 'Ordinary, but…',           body: "Tomorrow it'll be a memory" },
  { id: 6,  title: 'Anything interesting?',    body: 'Tell me with one photo' },
  { id: 7,  title: "Life's short",             body: "Don't let today slip through" },
  { id: 8,  title: 'Two seconds is enough',    body: "Film a short clip for 'future you'" },
  { id: 9,  title: 'Where are you right now?', body: 'Show me a little' },
  { id: 10, title: 'A small thing',            body: "Keep this moment — you'll be glad tomorrow" },
];

export const MESSAGES: Record<'vi' | 'en', ReminderMessage[]> = { vi: VI, en: EN };

export function pickMessage(language: string, exclude: number[]): ReminderMessage {
  const bank = language === 'en' ? MESSAGES.en : MESSAGES.vi;
  const available = bank.filter((m) => !exclude.includes(m.id));
  const pool = available.length > 0 ? available : bank;
  return pool[Math.floor(Math.random() * pool.length)];
}
