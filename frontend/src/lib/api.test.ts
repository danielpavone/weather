import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWeather } from '@/lib/api'
import { jsonResponse, saoPauloReport } from '@/test/fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getWeather', () => {
  it('monta a query só com a cidade e chama o backend', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (!input.startsWith('http://localhost:3000/api/weather')) {
        throw new Error(`URL inesperada: ${input}`)
      }
      return jsonResponse(saoPauloReport)
    })
    vi.stubGlobal('fetch', fetchMock)

    const report = await getWeather({ city: 'São Paulo' })
    const expected = new URL('http://localhost:3000/api/weather')
    expected.searchParams.set('city', 'São Paulo')

    expect(report.location.name).toBe('São Paulo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expected.toString())
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('open-meteo')
  })

  it('monta a query com latitude e longitude', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (!input.startsWith('http://localhost:3000/api/weather')) {
        throw new Error(`URL inesperada: ${input}`)
      }
      return jsonResponse(saoPauloReport)
    })
    vi.stubGlobal('fetch', fetchMock)

    await getWeather({ latitude: -23.55, longitude: -46.63 })
    const expected = new URL('http://localhost:3000/api/weather')
    expected.searchParams.set('latitude', '-23.55')
    expected.searchParams.set('longitude', '-46.63')

    expect(fetchMock).toHaveBeenCalledWith(expected.toString())
  })

  it('propaga a mensagem de erro do backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      message: 'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    }, 404)))

    await expect(getWeather({ city: 'Xyzzyville' })).rejects.toThrow(
      'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    )
  })

  it('rejeita uma resposta sem os dados atuais', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ location: { name: 'São Paulo' } })))

    await expect(getWeather({ city: 'São Paulo' })).rejects.toThrow(
      'O servidor retornou uma resposta inválida.',
    )
  })

  it('explica falha de rede sem chamar outro host', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (!input.startsWith('http://localhost:3000/api/weather')) {
        throw new Error(`URL inesperada: ${input}`)
      }
      throw new Error('offline')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getWeather({ city: 'São Paulo' })).rejects.toThrow(
      'Não foi possível conectar ao servidor. Verifique se a API está no ar.',
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://localhost:3000/api/weather')
  })
})
