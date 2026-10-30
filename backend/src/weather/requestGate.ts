export function createRequestGate(minIntervalMs: () => number) {
  let chain: Promise<void> = Promise.resolve();
  let lastStartedAt = 0;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const elapsed = Date.now() - lastStartedAt;
      const wait = Math.max(0, minIntervalMs() - elapsed);

      if (wait > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, wait);
        });
      }

      lastStartedAt = Date.now();
      return task();
    });

    chain = run.then(() => undefined, () => undefined);
    return run;
  };
}
