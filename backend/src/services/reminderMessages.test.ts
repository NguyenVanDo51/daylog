import { pickMessage, MESSAGES } from './reminderMessages';

describe('reminderMessages', () => {
  it('has 10 Vietnamese messages with ids 1–10', () => {
    expect(MESSAGES.vi).toHaveLength(10);
    expect(MESSAGES.vi.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('has 10 English messages with matching ids', () => {
    expect(MESSAGES.en).toHaveLength(10);
    expect(MESSAGES.en.map((m) => m.id)).toEqual(MESSAGES.vi.map((m) => m.id));
  });

  it('returns a Vietnamese message for language=vi', () => {
    const msg = pickMessage('vi', []);
    expect(MESSAGES.vi.find((m) => m.id === msg.id)).toBeDefined();
  });

  it('avoids ids in the exclude list when alternatives exist', () => {
    const exclude = [1, 2, 3];
    for (let i = 0; i < 100; i++) {
      const msg = pickMessage('vi', exclude);
      expect(exclude).not.toContain(msg.id);
    }
  });

  it('falls back to the full bank when exclude covers everything', () => {
    const allIds = MESSAGES.vi.map((m) => m.id);
    const msg = pickMessage('vi', allIds);
    expect(allIds).toContain(msg.id);
  });

  it('falls back to vi when language is unknown', () => {
    const msg = pickMessage('xx', []);
    expect(MESSAGES.vi.find((m) => m.id === msg.id)).toBeDefined();
  });
});
