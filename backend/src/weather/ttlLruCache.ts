interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlLruCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxSize: () => number,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    this.purgeExpired();
    return this.entries.size;
  }

  get(key: string): T | undefined {
    this.purgeExpired();
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) {
      return;
    }

    this.purgeExpired();
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    this.evictOverflow();
  }

  clear(): void {
    this.entries.clear();
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    const maxSize = this.maxSize();
    while (this.entries.size > maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.entries.delete(oldest);
    }
  }
}
