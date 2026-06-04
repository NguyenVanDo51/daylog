export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runSlot(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const slots = Array.from({ length: Math.min(limit, tasks.length) }, runSlot);
  await Promise.all(slots);
  return results;
}
