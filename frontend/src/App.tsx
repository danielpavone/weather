import { useEffect, useState } from 'react'
import { WeatherPanel } from '@/components/WeatherPanel'
import { getApiHealth } from '@/lib/api'

type ApiStatus = 'checking' | 'online' | 'offline'

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const checkApiStatus = async () => {
      const online = await getApiHealth()
      setApiStatus(online ? 'online' : 'offline')
    }

    void checkApiStatus()
    const interval = setInterval(() => {
      void checkApiStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const statusColor = apiStatus === 'online'
    ? 'bg-green-500'
    : apiStatus === 'offline'
      ? 'bg-red-500'
      : 'bg-yellow-500'

  const statusLabel = apiStatus === 'online'
    ? 'API online'
    : apiStatus === 'offline'
      ? 'API offline'
      : 'Verificando API'

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-background to-background">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-4 pb-24 pt-10 sm:pt-16">
        <WeatherPanel />
      </main>

      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 shadow-sm backdrop-blur-sm">
        <div className={`h-2.5 w-2.5 rounded-full ${statusColor} ${apiStatus === 'checking' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-muted-foreground">{statusLabel}</span>
      </div>
    </div>
  )
}

export default App
