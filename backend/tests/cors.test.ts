import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from '../src/cors';

describe('resolveCorsOrigins', () => {
  it('usa as origens locais do Vite quando a variável não existe', () => {
    expect(resolveCorsOrigins(undefined)).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('aceita uma lista separada por vírgula', () => {
    expect(resolveCorsOrigins('https://clima.example, https://app.example')).toEqual([
      'https://clima.example',
      'https://app.example',
    ]);
  });

  it('recusa o curinga *', () => {
    expect(() => resolveCorsOrigins('*')).toThrow(/não aceita \*/);
  });
});