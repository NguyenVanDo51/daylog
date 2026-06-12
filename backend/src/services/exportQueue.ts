const SLOTS = 2;
const MAX_PENDING = 4;

class Semaphore {
  private inUse = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly capacity: number) {}

  async acquire(): Promise<void> {
    if (this.inUse < this.capacity) {
      this.inUse++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inUse++;
  }

  release(): void {
    this.inUse--;
    const next = this.waiters.shift();
    if (next) next();
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('Export queue is full');
    this.name = 'QueueFullError';
  }
}

let pendingCount = 0;
let semaphore = new Semaphore(SLOTS);

export async function withExportSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (pendingCount >= MAX_PENDING) {
    throw new QueueFullError();
  }
  pendingCount++;
  try {
    await semaphore.acquire();
    try {
      return await fn();
    } finally {
      semaphore.release();
    }
  } finally {
    pendingCount--;
  }
}

// Test-only: drop any in-flight state between tests so cases stay isolated.
export function _resetQueueForTests(): void {
  pendingCount = 0;
  semaphore = new Semaphore(SLOTS);
}
