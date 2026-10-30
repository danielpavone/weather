import type { WeatherReport } from '@/types/weather'

export const saoPauloReport: WeatherReport = {
  location: {
    name: 'São Paulo',
    country: 'Brasil',
    admin1: 'São Paulo',
    latitude: -23.55,
    longitude: -46.63,
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
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
