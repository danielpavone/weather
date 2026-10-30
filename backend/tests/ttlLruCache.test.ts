import { describe, expect, it } from 'vitest';
import { TtlLruCache } from '../src/weather/ttlLruCache';

describe('TtlLruCache', () => {
  it('remove a entrada menos recente quando passa do teto', () => {
    const cache = new TtlLruCache<string>(() => 2);

    cache.set('a', 'A', 60_000);
    cache.set('b', 'B', 60_000);
    cache.get('a');
    cache.set('c', 'C', 60_000);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('A');
    expect(cache.get('c')).toBe('C');
    expect(cache.size).toBe(2);
  });

  it('remove entradas vencidas mesmo sem reler a mesma chave', () => {
    let now = 1_000;
    const cache = new TtlLruCache<string>(() => 10, () => now);

    cache.set('velha', 'expira', 500);
    cache.set('nova', 'fica', 5_000);
    expect(cache.size).toBe(2);

    now = 1_500;

    expect(cache.size).toBe(1);
    expect(cache.get('velha')).toBeUndefined();
    expect(cache.get('nova')).toBe('fica');
  });
});
