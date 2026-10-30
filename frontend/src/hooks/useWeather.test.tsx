import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeather } from '@/hooks/useWeather'
import { mockGeolocation } from '@/test/geolocation'
import { jsonResponse, saoPauloReport } from '@/test/fixtures'

beforeEach(() => {
  mockGeolocation('deny')
})

describe('useWeather', () => {
  it('mostra carregamento enquanto a busca não termina', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.status).toBe('idle'))

    act(() => {
      void result.current.searchCity('São Paulo')
    })

    await waitFor(() => expect(result.current.status).toBe('loading'))
    expect(result.current.loadingMessage).toBe('Buscando clima...')
  })

  it('guarda o erro retornado pela API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      message: 'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    }, 404)))
    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.status).toBe('idle'))
    await act(async () => {
      await result.current.searchCity('Xyzzyville')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe(
      'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    )
  })

  it('guarda o clima quando a busca tem sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(saoPauloReport)))
    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.status).toBe('idle'))
    await act(async () => {
      await result.current.searchCity('São Paulo')
    })

    expect(result.current.status).toBe('success')
    expect(result.current.report?.location.name).toBe('São Paulo')
    expect(result.current.report?.current.temperature).toBe(27.2)
    expect(result.current.city).toBe('São Paulo')
  })

  it('explica quando a geolocalização é negada', async () => {
    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.status).toBe('idle'))
    act(() => {
      result.current.requestCurrentLocation(false)
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toBe(
      'Permissão de localização negada. Você ainda pode buscar uma cidade pelo nome.',
    )
  })
})
