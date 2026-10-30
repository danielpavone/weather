import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/weather/service', () => ({
  getCurrentWeather: vi.fn(),
  clearWeatherCache: vi.fn(),
}));

import { createApp } from '../src/app';
import { getCurrentWeather } from '../src/weather/service';

describe('erros inesperados', () => {
  it('responde 500 com mensagem genérica e sem vazar err.message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getCurrentWeather).mockRejectedValue(
      new Error('segredo interno: postgres://user:pass@db/app'),
    );
    const app = createApp();

    const response = await request(app).get('/api/weather').query({ city: 'São Paulo' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
    expect(JSON.stringify(response.body)).not.toContain('segredo interno');
    expect(JSON.stringify(response.body)).not.toContain('postgres://');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
