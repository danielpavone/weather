import { vi } from 'vitest'

export function mockGeolocation(behavior: 'deny' | 'missing'): void {
  if (behavior === 'missing') {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
    return
  }

  const getCurrentPosition = vi.fn((
    _success: unknown,
    error?: ((positionError: { code: number; message: string }) => void) | null,
  ) => {
    error?.({
      code: 1,
      message: 'denied',
    })
  })

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
}
