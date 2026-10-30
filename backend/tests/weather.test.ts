import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { clearWeatherCache } from '../src/weather/service';

const app = createApp();

const saoPauloMatch = {
  name: 'São Paulo',
  latitude: -23.5475,
  longitude: -46.6361,
  country: 'Brasil',
  admin1: 'São Paulo',
  timezone: 'America/Sao_Paulo',
};

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
    temperature_2m: 27.2,
    apparent_temperature: 29.1,
    relative_humidity_2m: 61,
    wind_speed_10m: 13.4,
    weather_code: 2,
    is_day: 1,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockOpenMeteo(options?: {
  geocoding?: Response | Error;
  forecast?: Response | Error;
  reverse?: Response | Error;
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = String(input);

    if (url.includes('geocoding-api.open-meteo.com')) {
      if (options?.geocoding instanceof Error) {
        throw options.geocoding;
      }
      return options?.geocoding ?? jsonResponse({ results: [saoPauloMatch] });
    }

    if (url.includes('api.open-meteo.com')) {
      if (options?.forecast instanceof Error) {
        throw options.forecast;
      }
      return options?.forecast ?? jsonResponse(forecastPayload);
    }

    if (url.includes('nominatim.openstreetmap.org')) {
      if (options?.reverse instanceof Error) {
        throw options.reverse;
      }
      return options?.reverse ?? jsonResponse({
        address: {
          city: 'São Paulo',
          state: 'São Paulo',
          country: 'Brasil',
        },
      });
    }

    throw new Error(`URL inesperada: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  clearWeatherCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/weather', () => {
  it('retorna o clima atual de uma cidade', async () => {
    const fetchMock = mockOpenMeteo();

    const response = await request(app)
      .get('/api/weather')
      .query({ city: 'São Paulo' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      location: {
        name: 'São Paulo',
        country: 'Brasil',
        admin1: 'São Paulo',
        latitude: -23.5475,
        longitude: -46.6361,
        timezone: 'America/Sao_Paulo',
      },
      current: {
        time: '2026-10-30T15:00',
        temperature: 27.2,
        apparentTemperature: 29.1,
        humidity: 61,
        windSpeed: 13.4,
        weatherCode: 2,
        description: 'Parcialmente nublado',
        isDay: true,
      },
      units: {
        temperature: '°C',
        apparentTemperature: '°C',
        humidity: '%',
        windSpeed: 'km/h',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('geocoding-api.open-meteo.com');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('api.open-meteo.com');
  });

  it('responde 404 quando a cidade não existe', async () => {
    const fetchMock = mockOpenMeteo({
      geocoding: jsonResponse({}),
    });

    const response = await request(app)
      .get('/api/weather')
      .query({ city: 'CidadeInexistenteXYZ' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('responde 502 quando a API externa falha', async () => {
    mockOpenMeteo({
      geocoding: new Error('network down'),
    });

    const response = await request(app)
      .get('/api/weather')
      .query({ city: 'São Paulo' });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe(
      'Não foi possível consultar o serviço de clima. Tente novamente em instantes.',
    );
  });

  it('responde 502 quando a previsão retorna erro HTTP', async () => {
    mockOpenMeteo({
      forecast: jsonResponse({ reason: 'upstream' }, 500),
    });

    const response = await request(app)
      .get('/api/weather')
      .query({ city: 'São Paulo' });

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/serviço de clima/);
  });

  it('responde 400 quando a cidade não é informada', async () => {
    const fetchMock = mockOpenMeteo();

    const missing = await request(app).get('/api/weather');
    const blank = await request(app).get('/api/weather').query({ city: '   ' });

    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('Informe o nome de uma cidade.');
    expect(blank.status).toBe(400);
    expect(blank.body.message).toBe('Informe o nome de uma cidade.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 400 quando a cidade tem apenas um caractere', async () => {
    const fetchMock = mockOpenMeteo();

    const response = await request(app).get('/api/weather').query({ city: 'a' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Informe pelo menos 2 caracteres para buscar uma cidade.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 400 quando latitude ou longitude são inválidas', async () => {
    const fetchMock = mockOpenMeteo();

    const response = await request(app)
      .get('/api/weather')
      .query({ latitude: 'norte', longitude: '10' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Latitude ou longitude inválida.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aceita latitude e longitude e resolve o nome da cidade', async () => {
    mockOpenMeteo();

    const response = await request(app)
      .get('/api/weather')
      .query({ latitude: '-23.55', longitude: '-46.63' });

    expect(response.status).toBe(200);
    expect(response.body.location).toMatchObject({
      name: 'São Paulo',
      country: 'Brasil',
      admin1: 'São Paulo',
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(response.body.current.temperature).toBe(27.2);
  });

  it('mantém o clima por coordenadas quando a geocodificação reversa falha', async () => {
    const fetchMock = mockOpenMeteo({
      reverse: new Error('nominatim down'),
    });

    const response = await request(app)
      .get('/api/weather')
      .query({ latitude: '-23.55', longitude: '-46.63' });

    expect(response.status).toBe(200);
    expect(response.body.location.name).toBeNull();
    expect(response.body.current.description).toBe('Parcialmente nublado');
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('api.open-meteo.com'))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('nominatim.openstreetmap.org'))).toBe(true);
  });

  it('mantém o clima quando o Nominatim responde com erro HTTP', async () => {
    const fetchMock = mockOpenMeteo({
      reverse: jsonResponse({ error: 'rate limited' }, 429),
    });

    const response = await request(app)
      .get('/api/weather')
      .query({ latitude: '48.86', longitude: '2.35' });

    expect(response.status).toBe(200);
    expect(response.body.location.name).toBeNull();
    expect(response.body.current.temperature).toBe(27.2);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('nominatim.openstreetmap.org'))).toBe(true);
  });

  it('envia User-Agent identificável ao Nominatim', async () => {
    const fetchMock = mockOpenMeteo();

    const response = await request(app)
      .get('/api/weather')
      .query({ latitude: '-22.90', longitude: '-43.17' });

    expect(response.status).toBe(200);
    const nominatimCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('nominatim.openstreetmap.org'));
    const init = nominatimCall?.[1] as { headers?: Record<string, string> } | undefined;

    expect(init?.headers?.['User-Agent']).toBe(
      'weather-dashboard/1.0 (https://github.com/danielpavone/weather)',
    );
  });

  it('reaproveita o cache e não chama a Open-Meteo de novo para a mesma cidade', async () => {
    const fetchMock = mockOpenMeteo();

    const first = await request(app).get('/api/weather').query({ city: 'São Paulo' });
    const second = await request(app).get('/api/weather').query({ city: 'são paulo' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('responde 400 quando o nome da cidade é longo demais', async () => {
    const fetchMock = mockOpenMeteo();

    const response = await request(app)
      .get('/api/weather')
      .query({ city: 'a'.repeat(101) });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('O nome da cidade pode ter no máximo 100 caracteres.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
