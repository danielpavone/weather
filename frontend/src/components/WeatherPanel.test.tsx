import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WeatherPanel } from '@/components/WeatherPanel'
import { mockGeolocation } from '@/test/geolocation'
import { jsonResponse, saoPauloReport } from '@/test/fixtures'

beforeEach(() => {
  mockGeolocation('deny')
})

async function renderIdlePanel() {
  render(<WeatherPanel />)
  expect(await screen.findByText(/Busque uma cidade para ver o clima atual/)).toBeInTheDocument()
}

describe('WeatherPanel', () => {
  it('mostra o estado vazio quando a geolocalização silenciosa é negada', async () => {
    await renderIdlePanel()
    expect(screen.getByRole('heading', { name: 'Clima agora' })).toBeInTheDocument()
    expect(screen.getByLabelText('Cidade')).toBeInTheDocument()
  })

  it('mostra carregamento e depois o clima da cidade buscada', async () => {
    let resolveFetch: (response: Response) => void = () => undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))
    const user = userEvent.setup()

    await renderIdlePanel()
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Buscando clima...')).toBeInTheDocument()

    resolveFetch(jsonResponse(saoPauloReport))

    expect(await screen.findByRole('heading', { name: 'São Paulo' })).toBeInTheDocument()
    expect(screen.getByText('Parcialmente nublado')).toBeInTheDocument()
    expect(screen.getByText('27,2 °C')).toBeInTheDocument()
    expect(screen.getByText('61 %')).toBeInTheDocument()
  })

  it('mostra a mensagem de erro do backend para uma cidade inexistente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      message: 'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    }, 404)))
    const user = userEvent.setup()

    await renderIdlePanel()
    await user.type(screen.getByLabelText('Cidade'), 'Xyzzyville')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não encontramos essa cidade. Verifique o nome e tente novamente.',
    )
  })

  it('continua utilizável quando o usuário nega a localização', async () => {
    const user = userEvent.setup()
    await renderIdlePanel()

    await user.click(screen.getByRole('button', { name: 'Usar minha localização' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permissão de localização negada. Você ainda pode buscar uma cidade pelo nome.',
    )
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('busca apenas o backend', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (!input.startsWith('http://localhost:3000/api/weather')) {
        throw new Error(`URL inesperada: ${input}`)
      }
      return jsonResponse(saoPauloReport)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    await renderIdlePanel()
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://localhost:3000/api/weather')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('open-meteo')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('nominatim')
  })
})
