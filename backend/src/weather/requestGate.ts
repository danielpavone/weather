export class QueueFullError extends Error {
  constructor() {
    super('Fila do Nominatim cheia');
    this.name = 'QueueFullError';
  }
}

export function createRequestGate(options: {
  minIntervalMs: () => number;
  maxPending: () => number;
}) {
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;
  let lastStartedAt = 0;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    if (pending >= options.maxPending()) {
      return Promise.reject(new QueueFullError());
    }

    pending += 1;
    const run = chain.then(async () => {
      const elapsed = Date.now() - lastStartedAt;
      const wait = Math.max(0, options.minIntervalMs() - elapsed);

      if (wait > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, wait);
        });
      }

      lastStartedAt = Date.now();
      return task();
    });

    chain = run.then(() => undefined, () => undefined);
    void run.finally(() => {
      pending -= 1;
    });

    return run;
  };
}
