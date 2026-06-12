import { withExportSlot, QueueFullError, _resetQueueForTests } from './exportQueue';

describe('exportQueue', () => {
  beforeEach(() => _resetQueueForTests());

  it('allows the first 2 callers to run concurrently', async () => {
    const order: string[] = [];
    const release: Array<() => void> = [];
    const block = () => new Promise<void>((r) => release.push(r));

    const p1 = withExportSlot(async () => { order.push('a-start'); await block(); order.push('a-end'); });
    const p2 = withExportSlot(async () => { order.push('b-start'); await block(); order.push('b-end'); });

    await new Promise((r) => setImmediate(r));
    expect(order).toEqual(['a-start', 'b-start']);

    release.forEach((r) => r());
    await Promise.all([p1, p2]);
  });

  it('queues a 3rd caller until a slot frees', async () => {
    const release: Array<() => void> = [];
    const block = () => new Promise<void>((r) => release.push(r));
    let thirdStarted = false;

    const p1 = withExportSlot(block);
    const p2 = withExportSlot(block);
    const p3 = withExportSlot(async () => { thirdStarted = true; });

    await new Promise((r) => setImmediate(r));
    expect(thirdStarted).toBe(false);

    release[0]();
    await p1;
    await p3;
    expect(thirdStarted).toBe(true);

    release[1]();
    await p2;
  });

  it('throws QueueFullError when a 5th caller arrives with 4 already pending', async () => {
    // Shared latch — every slot's fn awaits the same promise so we can unblock
    // all 4 (active + queued) with one call. The per-slot `release[]` pattern
    // used in earlier tests deadlocks here: slots 3 and 4 are parked inside
    // semaphore.acquire() and their fn hasn't been invoked yet, so they never
    // push to release[]. A forEach over [slot1, slot2] only unblocks the two
    // active slots; slots 3 and 4 then wake, call block(), push resolvers —
    // but the forEach is already done, so those resolvers are never called.
    let releaseAll!: () => void;
    const allDone = new Promise<void>((r) => { releaseAll = r; });

    const slots = [
      withExportSlot(() => allDone),
      withExportSlot(() => allDone),
      withExportSlot(() => allDone),
      withExportSlot(() => allDone),
    ];
    await new Promise((r) => setImmediate(r));

    await expect(withExportSlot(async () => 'x')).rejects.toBeInstanceOf(QueueFullError);

    releaseAll();
    await Promise.all(slots);
  });

  it('decrements pending on error so subsequent callers can proceed', async () => {
    await expect(
      withExportSlot(async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');

    const ok = await withExportSlot(async () => 'ok');
    expect(ok).toBe('ok');
  });
});
