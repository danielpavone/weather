import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { clearWeatherCache } from '../src/weather/service';

const forecastPayload = {
  timezone: 'America/Sao_Paulo',
  current_units: {
    temperature_2m: '°C',
    apparent_temperature: '°C',
    relative_humidity_2m: '%',
    wind_speed_10m: 'km/h',
  },
  current: {
    time: '2026-10-30T15:00',
    temperature_2m: 22,
    apparent_temperature: 22,
    relative_humidity_2m: 70,
    wind_speed_10m: 8,
    weather_code: 0,
    is_day: 1,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  clearWeatherCache();
  vi.unstubAllGlobals();
});

describe('CORS', () => {
  it('libera apenas as origens de desenvolvimento por padrão', async () => {
    const previous = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;
    const app = createApp();
    if (previous === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previous;
    }

    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    const loopback = await request(app).get('/health').set('Origin', 'http://127.0.0.1:5173');
    const blocked = await request(app).get('/health').set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(loopback.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('respeita CORS_ORIGIN quando a variável está definida', async () => {
    const previous = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'https://clima.example';
    const app = createApp();
    if (previous === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previous;
    }

    const allowed = await request(app).get('/health').set('Origin', 'https://clima.example');
    const dev = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(allowed.headers['access-control-allow-origin']).toBe('https://clima.example');
    expect(dev.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('limite de consultas', () => {
  it('responde 429 quando o limite do endpoint é excedido', async () => {
    const previous = process.env.WEATHER_RATE_LIMIT_MAX;
    process.env.WEATHER_RATE_LIMIT_MAX = '1';
    const app = createApp();
    if (previous === undefined) {
      delete process.env.WEATHER_RATE_LIMIT_MAX;
    } else {
      process.env.WEATHER_RATE_LIMIT_MAX = previous;
    }

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return jsonResponse({
          results: [{
            name: 'Recife',
            latitude: -8.05,
            longitude: -34.88,
            country: 'Brasil',
            admin1: 'Pernambuco',
            timezone: 'America/Recife',
          }],
        });
      }

      if (url.includes('api.open-meteo.com')) {
        return jsonResponse(forecastPayload);
      }

      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await request(app).get('/api/weather').query({ city: 'Recife' });
    const second = await request(app).get('/api/weather').query({ city: 'Salvador' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      message: 'Muitas consultas em pouco tempo. Tente novamente em instantes.',
    });
  });

  it('aplica o limite por IP encaminhado quando TRUST_PROXY=1', async () => {
    const previousLimit = process.env.WEATHER_RATE_LIMIT_MAX;
    const previousProxy = process.env.TRUST_PROXY;
    process.env.WEATHER_RATE_LIMIT_MAX = '1';
    process.env.TRUST_PROXY = '1';
    const app = createApp();
    if (previousLimit === undefined) {
      delete process.env.WEATHER_RATE_LIMIT_MAX;
    } else {
      process.env.WEATHER_RATE_LIMIT_MAX = previousLimit;
    }
    if (previousProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = previousProxy;
    }

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return jsonResponse({
          results: [{
            name: 'Recife',
            latitude: -8.05,
            longitude: -34.88,
            country: 'Brasil',
            admin1: 'Pernambuco',
            timezone: 'America/Recife',
          }],
        });
      }
      if (url.includes('api.open-meteo.com')) {
        return jsonResponse(forecastPayload);
      }
      throw new Error(`URL inesperada: ${url}`);
    }));

    const first = await request(app)
      .get('/api/weather')
      .query({ city: 'Recife' })
      .set('X-Forwarded-For', '203.0.113.10');
    const other = await request(app)
      .get('/api/weather')
      .query({ city: 'Salvador' })
      .set('X-Forwarded-For', '203.0.113.20');
    const again = await request(app)
      .get('/api/weather')
      .query({ city: 'Curitiba' })
      .set('X-Forwarded-For', '203.0.113.10');

    expect(first.status).toBe(200);
    expect(other.status).toBe(200);
    expect(again.status).toBe(429);
  });
});
