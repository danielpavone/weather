import type { WeatherQuery, WeatherReport } from '@/types/weather'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

interface ErrorPayload {
  message?: string
}

export async function getApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function getWeather(query: WeatherQuery): Promise<WeatherReport> {
  const params = new URLSearchParams()

  if (query.city) {
    params.set('city', query.city)
  }

  if (typeof query.latitude === 'number') {
    params.set('latitude', String(query.latitude))
  }

  if (typeof query.longitude === 'number') {
    params.set('longitude', String(query.longitude))
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/weather?${params.toString()}`)
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se a API está no ar.')
  }

  const payload = await response.json().catch(() => null) as ErrorPayload | WeatherReport | null

  if (!response.ok) {
    const message = payload && 'message' in payload && payload.message
      ? payload.message
      : 'Não foi possível consultar o clima.'
    throw new Error(message)
  }

  if (!payload || !('current' in payload)) {
    throw new Error('O servidor retornou uma resposta inválida.')
  }

  return payload
}
