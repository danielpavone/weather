import { describe, expect, it } from 'vitest';
import { createRequestGate } from '../src/weather/requestGate';

describe('createRequestGate', () => {
  it('espaça chamadas pelo intervalo mínimo', async () => {
    const gate = createRequestGate(() => 40);
    const stamps: number[] = [];

    await Promise.all([
      gate(async () => {
        stamps.push(Date.now());
      }),
      gate(async () => {
        stamps.push(Date.now());
      }),
      gate(async () => {
        stamps.push(Date.now());
      }),
    ]);

    expect(stamps).toHaveLength(3);
    expect(stamps[1] - stamps[0]).toBeGreaterThanOrEqual(35);
    expect(stamps[2] - stamps[1]).toBeGreaterThanOrEqual(35);
  });
});
