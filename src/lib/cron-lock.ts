interface LockEntry {
  acquiredAt: number;
  maxHoldMs: number;
}

const locks = new Map<string, LockEntry>();

export function acquireLock(name: string, maxHoldMs = 300_000): boolean {
  const now = Date.now();
  const existing = locks.get(name);

  if (existing) {
    // Auto-expire: if held longer than maxHoldMs, allow re-acquisition
    if (now - existing.acquiredAt < existing.maxHoldMs) {
      return false;
    }
    console.warn(`[CRON-LOCK] Lock "${name}" auto-expired after ${now - existing.acquiredAt}ms (max: ${existing.maxHoldMs}ms)`);
  }

  locks.set(name, { acquiredAt: now, maxHoldMs });
  return true;
}

export function releaseLock(name: string): void {
  locks.delete(name);
}

export function getLockInfo(name: string): { held: boolean; acquiredAt?: number } {
  const entry = locks.get(name);
  if (!entry) return { held: false };

  const now = Date.now();
  if (now - entry.acquiredAt >= entry.maxHoldMs) {
    locks.delete(name);
    return { held: false };
  }

  return { held: true, acquiredAt: entry.acquiredAt };
}
