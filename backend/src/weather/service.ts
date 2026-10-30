import { HttpError } from '../httpError';
import { describeWeatherCode } from './descriptions';
import { createRequestGate } from './requestGate';
import type { WeatherQuery, WeatherReport } from './types';

const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_GEOCODING_API_URL = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_NOMINATIM_USER_AGENT = 'weather-dashboard/1.0 (https://github.com/danielpavone/weather)';
const MAX_CITY_LENGTH = 100;
const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'weather_code',
  'is_day',
].join(',');
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_REVERSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NOMINATIM_INTERVAL_MS = 1000;
const EXTERNAL_FAILURE_MESSAGE =
  'Não foi possível consultar o serviço de clima. Tente novamente em instantes.';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const weatherCache = new Map<string, CacheEntry<WeatherReport>>();
const reverseCache = new Map<string, CacheEntry<Pick<ResolvedPlace, 'name' | 'country' | 'admin1'>>>();
const scheduleNominatim = createRequestGate(() => readNonNegativeInt(
  process.env.NOMINATIM_MIN_INTERVAL_MS,
  DEFAULT_NOMINATIM_INTERVAL_MS,
));

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) {
    return;
  }

  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cityCacheKey(city: string): string {
  return `city:${city.toLocaleLowerCase('pt-BR')}`;
}

function coordinateCacheKey(latitude: number, longitude: number): string {
  return `coords:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

function nominatimUserAgent(): string {
  const configured = process.env.NOMINATIM_USER_AGENT?.trim();
  return configured ? configured : DEFAULT_NOMINATIM_USER_AGENT;
}

export function clearWeatherCache(): void {
  weatherCache.clear();
  reverseCache.clear();
}

interface GeocodingMatch {
  name?: unknown;
  country?: unknown;
  admin1?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
}

interface ForecastPayload {
  timezone?: unknown;
  current_units?: {
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    relative_humidity_2m?: unknown;
    wind_speed_10m?: unknown;
  };
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    relative_humidity_2m?: unknown;
    wind_speed_10m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
  };
}

interface ReverseGeocodingAddress {
  city?: unknown;
  town?: unknown;
  village?: unknown;
  municipality?: unknown;
  city_district?: unknown;
  county?: unknown;
  state?: unknown;
  country?: unknown;
}

interface ResolvedPlace {
  name: string | null;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseCoordinate(raw: string, min: number, max: number): number | undefined {
  if (raw === '') {
    return undefined;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, 'Latitude ou longitude inválida.');
  }

  return value;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, EXTERNAL_FAILURE_MESSAGE);
  }

  if (!response.ok) {
    throw new HttpError(502, EXTERNAL_FAILURE_MESSAGE);
  }

  try {
    return await response.json();
  } catch {
    throw new HttpError(502, EXTERNAL_FAILURE_MESSAGE);
  }
}

async function geocodeCity(city: string): Promise<ResolvedPlace> {
  const url = new URL(GEOCODING_API_URL);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'pt');
  url.searchParams.set('format', 'json');

  const payload = await fetchJson(url.toString());
  const results = isRecord(payload) && Array.isArray(payload.results)
    ? payload.results
    : [];
  const match = results[0] as GeocodingMatch | undefined;

  if (!match) {
    throw new HttpError(
      404,
      'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    );
  }

  const latitude = readNumber(match.latitude);
  const longitude = readNumber(match.longitude);
  const name = readString(match.name);

  if (latitude === null || longitude === null || name === null) {
    throw new HttpError(502, EXTERNAL_FAILURE_MESSAGE);
  }

  return {
    name,
    country: readString(match.country),
    admin1: readString(match.admin1),
    latitude,
    longitude,
    timezone: readString(match.timezone),
  };
}

async function requestReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Pick<ResolvedPlace, 'name' | 'country' | 'admin1'> | null> {
  const url = new URL(REVERSE_GEOCODING_API_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('accept-language', 'pt-BR');
  url.searchParams.set('zoom', '10');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': nominatimUserAgent(),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.address)) {
      return null;
    }

    const address = payload.address as ReverseGeocodingAddress;
    const name = [
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.city_district,
      address.county,
    ]
      .map(readString)
      .find((value): value is string => value !== null);

    return {
      name: name ?? null,
      country: readString(address.country),
      admin1: readString(address.state),
    };
  } catch {
    return null;
  }
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Pick<ResolvedPlace, 'name' | 'country' | 'admin1'> | null> {
  const key = coordinateCacheKey(latitude, longitude);
  const cached = readCache(reverseCache, key);
  if (cached) {
    return cached;
  }

  const place = await scheduleNominatim(() => requestReverseGeocode(latitude, longitude));
  if (place) {
    writeCache(
      reverseCache,
      key,
      place,
      readNonNegativeInt(process.env.REVERSE_GEOCODE_CACHE_TTL_MS, DEFAULT_REVERSE_CACHE_TTL_MS),
    );
  }

  return place;
}

async function fetchForecast(
  latitude: number,
  longitude: number,
  timezone: string | null,
): Promise<Pick<WeatherReport, 'current' | 'units'> & { timezone: string | null }> {
  const url = new URL(FORECAST_API_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', CURRENT_FIELDS);
  url.searchParams.set('timezone', timezone ?? 'auto');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const payload = await fetchJson(url.toString()) as ForecastPayload;
  const current = payload.current;
  const units = payload.current_units;

  const temperature = readNumber(current?.temperature_2m);
  const apparentTemperature = readNumber(current?.apparent_temperature);
  const humidity = readNumber(current?.relative_humidity_2m);
  const windSpeed = readNumber(current?.wind_speed_10m);
  const weatherCode = readNumber(current?.weather_code);
  const time = readString(current?.time);

  if (
    temperature === null ||
    apparentTemperature === null ||
    humidity === null ||
    windSpeed === null ||
    weatherCode === null ||
    time === null
  ) {
    throw new HttpError(502, EXTERNAL_FAILURE_MESSAGE);
  }

  const isDayValue = readNumber(current?.is_day);

  return {
    timezone: readString(payload.timezone) ?? timezone,
    units: {
      temperature: readString(units?.temperature_2m) ?? '°C',
      apparentTemperature: readString(units?.apparent_temperature) ?? '°C',
      humidity: readString(units?.relative_humidity_2m) ?? '%',
      windSpeed: readString(units?.wind_speed_10m) ?? 'km/h',
    },
    current: {
      time,
      temperature,
      apparentTemperature,
      humidity,
      windSpeed,
      weatherCode,
      description: describeWeatherCode(weatherCode),
      isDay: isDayValue === null ? true : isDayValue === 1,
    },
  };
}

function toReport(
  place: ResolvedPlace,
  forecast: Pick<WeatherReport, 'current' | 'units'> & { timezone: string | null },
): WeatherReport {
  return {
    location: {
      name: place.name,
      country: place.country,
      admin1: place.admin1,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: forecast.timezone ?? place.timezone,
    },
    current: forecast.current,
    units: forecast.units,
  };
}

function rememberWeather(key: string, report: WeatherReport): WeatherReport {
  writeCache(
    weatherCache,
    key,
    report,
    readNonNegativeInt(process.env.WEATHER_CACHE_TTL_MS, DEFAULT_WEATHER_CACHE_TTL_MS),
  );
  return report;
}

export async function getCurrentWeather(query: WeatherQuery): Promise<WeatherReport> {
  const city = query.city.trim();

  if (city.length > MAX_CITY_LENGTH) {
    throw new HttpError(400, 'O nome da cidade pode ter no máximo 100 caracteres.');
  }

  if (city.length >= 2) {
    const key = cityCacheKey(city);
    const cached = readCache(weatherCache, key);
    if (cached) {
      return cached;
    }

    const place = await geocodeCity(city);
    const forecast = await fetchForecast(place.latitude, place.longitude, place.timezone);
    return rememberWeather(key, toReport(place, forecast));
  }

  if (city.length === 1) {
    throw new HttpError(400, 'Informe pelo menos 2 caracteres para buscar uma cidade.');
  }

  const latitude = parseCoordinate(query.latitude.trim(), -90, 90);
  const longitude = parseCoordinate(query.longitude.trim(), -180, 180);

  if (latitude === undefined && longitude === undefined) {
    throw new HttpError(400, 'Informe o nome de uma cidade.');
  }

  if (latitude === undefined || longitude === undefined) {
    throw new HttpError(400, 'Informe latitude e longitude juntas.');
  }

  const key = coordinateCacheKey(latitude, longitude);
  const cached = readCache(weatherCache, key);
  if (cached) {
    return cached;
  }

  const [place, forecast] = await Promise.all([
    reverseGeocode(latitude, longitude),
    fetchForecast(latitude, longitude, null),
  ]);

  const report = toReport(
    {
      name: place?.name ?? null,
      country: place?.country ?? null,
      admin1: place?.admin1 ?? null,
      latitude,
      longitude,
      timezone: null,
    },
    forecast,
  );

  if (!place) {
    return report;
  }

  return rememberWeather(key, report);
}
