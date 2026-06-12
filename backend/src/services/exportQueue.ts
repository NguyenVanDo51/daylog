const SLOTS = 2;
// Maximum total callers (active + queued) allowed before further calls are rejected.
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
    // Wait without incrementing. release() transfers the slot directly to us
    // — bumping inUse here would let a fast-path caller racing between the
    // resolve and this microtask exceed capacity.
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Slot transfers to the waiter; inUse stays at capacity.
      next();
    } else {
      this.inUse--;
    }
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

/**
 * Exporting queue slot.
 * @param fn Callback
 * @returns Result of the callback
 */
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
