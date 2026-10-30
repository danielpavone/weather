import type { FormEvent } from 'react'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Loader2,
  LocateFixed,
  MapPin,
  Moon,
  Search,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWeather } from '@/hooks/useWeather'
import type { WeatherCurrent, WeatherLocation, WeatherReport } from '@/types/weather'

function WeatherGlyph({ current }: { current: WeatherCurrent }) {
  const className = 'h-12 w-12 text-sky-700'
  const code = current.weatherCode

  if (code === 0) {
    return current.isDay ? <Sun className={className} /> : <Moon className={className} />
  }

  if (code === 1 || code === 2) {
    return <CloudSun className={className} />
  }

  if (code === 3) {
    return <Cloud className={className} />
  }

  if (code === 45 || code === 48) {
    return <CloudFog className={className} />
  }

  if (code >= 95) {
    return <CloudLightning className={className} />
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <Snowflake className={className} />
  }

  if (code >= 51) {
    return <CloudRain className={className} />
  }

  return <Cloud className={className} />
}

function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatTemperature(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`
}

function formatObservedAt(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match
  return `${day}/${month}/${year} às ${hour}:${minute}`
}

function locationSubtitle(location: WeatherLocation): string {
  const parts = [location.admin1, location.country].filter((part): part is string => Boolean(part))
  const unique = parts.filter((part, index) => parts.indexOf(part) === index)

  if (location.name && unique[0] === location.name) {
    unique.shift()
  }

  return unique.join(' · ')
}

function WeatherCard({ report }: { report: WeatherReport }) {
  const subtitle = locationSubtitle(report.location)
  const coordinates = `${formatNumber(report.location.latitude, 2)}, ${formatNumber(report.location.longitude, 2)}`

  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {report.location.name ?? 'Localização atual'}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>{subtitle || coordinates}</span>
          </p>
        </div>
        <WeatherGlyph current={report.current} />
      </div>

      <p className="mt-6 text-6xl font-semibold tracking-tight">
        {formatTemperature(report.current.temperature, report.units.temperature)}
      </p>
      <p className="mt-2 text-lg">{report.current.description}</p>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-secondary/70 px-3 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
            Sensação
          </dt>
          <dd className="mt-1 text-base font-semibold">
            {formatTemperature(report.current.apparentTemperature, report.units.apparentTemperature)}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary/70 px-3 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            Umidade
          </dt>
          <dd className="mt-1 text-base font-semibold">
            {formatNumber(report.current.humidity, 0)} {report.units.humidity}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary/70 px-3 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            Vento
          </dt>
          <dd className="mt-1 text-base font-semibold">
            {formatNumber(report.current.windSpeed)} {report.units.windSpeed}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Atualizado em {formatObservedAt(report.current.time)}
        {report.location.timezone ? ` · ${report.location.timezone}` : ''}
      </p>
    </article>
  )
}

export function WeatherPanel() {
  const {
    city,
    setCity,
    status,
    report,
    errorMessage,
    loadingMessage,
    searchCity,
    requestCurrentLocation,
  } = useWeather()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void searchCity(city)
  }

  return (
    <section className="w-full max-w-xl" aria-labelledby="weather-title">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Painel</p>
        <h1 id="weather-title" className="mt-1 text-4xl font-bold tracking-tight">
          Clima agora
        </h1>
        <p className="mt-2 text-muted-foreground">
          Digite uma cidade para ver a temperatura, a sensação térmica, a umidade e o vento.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-4 shadow-sm">
        <label htmlFor="city" className="text-sm font-medium">
          Cidade
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="city"
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Ex.: São Paulo"
            autoComplete="off"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={status === 'loading'} className="flex-1 sm:flex-none">
              <Search aria-hidden="true" />
              Buscar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={status === 'loading'}
              aria-label="Usar minha localização"
              onClick={() => requestCurrentLocation(false)}
            >
              <LocateFixed aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        {status === 'loading' && (
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-5 text-sm text-muted-foreground shadow-sm" aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingMessage}
          </div>
        )}

        {status === 'error' && errorMessage && (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {status === 'idle' && (
          <p className="rounded-2xl border border-dashed bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Busque uma cidade para ver o clima atual. Se você permitir, o painel também sugere a cidade da sua localização.
          </p>
        )}

        {status === 'success' && report && <WeatherCard report={report} />}
      </div>
    </section>
  )
}
