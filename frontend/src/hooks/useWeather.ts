import { useCallback, useEffect, useRef, useState } from 'react'
import { getWeather } from '@/lib/api'
import type { WeatherReport } from '@/types/weather'

type Status = 'idle' | 'loading' | 'success' | 'error'

const LOCATION_TIMEOUT_MS = 8000

export function useWeather() {
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [report, setReport] = useState<WeatherReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Buscando clima...')
  const requestId = useRef(0)

  const searchCity = useCallback(async (name: string) => {
    const trimmed = name.trim()

    if (trimmed.length < 2) {
      setStatus('error')
      setErrorMessage('Informe pelo menos 2 caracteres para buscar uma cidade.')
      return
    }

    const id = ++requestId.current
    setStatus('loading')
    setLoadingMessage('Buscando clima...')
    setErrorMessage(null)

    try {
      const data = await getWeather({ city: trimmed })
      if (id !== requestId.current) {
        return
      }

      setReport(data)
      setCity(data.location.name ?? trimmed)
      setStatus('success')
    } catch (error) {
      if (id !== requestId.current) {
        return
      }

      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível consultar o clima.')
    }
  }, [])

  const searchCoordinates = useCallback(async (latitude: number, longitude: number, id: number) => {
    try {
      const data = await getWeather({ latitude, longitude })
      if (id !== requestId.current) {
        return
      }

      setReport(data)
      setCity((current) => {
        if (current.trim() !== '') {
          return current
        }

        return data.location.name ?? ''
      })
      setStatus('success')
    } catch (error) {
      if (id !== requestId.current) {
        return
      }

      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível consultar o clima.')
    }
  }, [])

  const requestCurrentLocation = useCallback((silent: boolean) => {
    if (!navigator.geolocation) {
      if (!silent) {
        setStatus('error')
        setErrorMessage('Seu navegador não oferece geolocalização. Busque a cidade pelo nome.')
      }
      return
    }

    const id = ++requestId.current
    setStatus('loading')
    setLoadingMessage('Obtendo sua localização...')
    setErrorMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) {
          return
        }

        setLoadingMessage('Buscando clima...')
        void searchCoordinates(position.coords.latitude, position.coords.longitude, id)
      },
      () => {
        if (id !== requestId.current) {
          return
        }

        if (silent) {
          setStatus('idle')
          return
        }

        setStatus('error')
        setErrorMessage('Permissão de localização negada. Você ainda pode buscar uma cidade pelo nome.')
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    )
  }, [searchCoordinates])

  useEffect(() => {
    requestCurrentLocation(true)
  }, [requestCurrentLocation])

  return {
    city,
    setCity,
    status,
    report,
    errorMessage,
    loadingMessage,
    searchCity,
    requestCurrentLocation,
  }
}
