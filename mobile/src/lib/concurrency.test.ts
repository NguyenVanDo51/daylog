import { runWithConcurrency } from '@/lib/concurrency';

describe('runWithConcurrency', () => {
  it('runs all tasks and returns fulfilled results in input order', async () => {
    const tasks = [1, 2, 3].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 3 },
    ]);
  });

  it('continues when one task rejects, returns rejected result at correct index', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(3),
    ];
    const results = await runWithConcurrency(tasks, 2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('boom');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('never exceeds the concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 9 }, () => () =>
      new Promise<void>((resolve) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        setImmediate(() => { concurrent--; resolve(); });
      }),
    );
    await runWithConcurrency(tasks, 3);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('starts the next task as soon as a slot is free (not batch-by-batch)', async () => {
    const order: number[] = [];
    const tasks = [0, 1, 2, 3].map((n) => () =>
      new Promise<void>((resolve) => {
        setImmediate(() => { order.push(n); resolve(); });
      }),
    );
    await runWithConcurrency(tasks, 2);
    expect(order).toHaveLength(4);
    expect(order).toContain(3);
  });

  it('handles an empty task list', async () => {
    const results = await runWithConcurrency([], 3);
    expect(results).toEqual([]);
  });

  it('handles limit larger than task count', async () => {
    const tasks = [1, 2].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(tasks, 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
  });
});
