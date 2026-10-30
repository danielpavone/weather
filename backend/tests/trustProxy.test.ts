import { describe, expect, it } from 'vitest';
import { resolveTrustProxy } from '../src/trustProxy';

describe('resolveTrustProxy', () => {
  it('não confia em proxy quando a variável está ausente', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy('')).toBe(false);
    expect(resolveTrustProxy('false')).toBe(false);
  });

  it('aceita um número de hops', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('2')).toBe(2);
  });

  it('recusa true porque confiaria em qualquer cliente', () => {
    expect(() => resolveTrustProxy('true')).toThrow(/número de hops/);
  });
});
