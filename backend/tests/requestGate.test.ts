import { describe, expect, it } from 'vitest';
import { createRequestGate, QueueFullError } from '../src/weather/requestGate';

describe('createRequestGate', () => {
  it('espaça chamadas pelo intervalo mínimo', async () => {
    const gate = createRequestGate({
      minIntervalMs: () => 40,
      maxPending: () => 10,
    });
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

  it('rejeita a tarefa quando a fila já está no teto', async () => {
    const gate = createRequestGate({
      minIntervalMs: () => 0,
      maxPending: () => 1,
    });
    let release: () => void = () => undefined;
    const first = gate(() => new Promise<string>((resolve) => {
      release = () => resolve('primeira');
    }));

    await expect(gate(async () => 'segunda')).rejects.toBeInstanceOf(QueueFullError);

    release();
    await expect(first).resolves.toBe('primeira');
  });
});
