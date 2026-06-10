import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, Cloud, CloudRain, Droplets, MapPin, RefreshCw, Shirt, Sun, Thermometer, Waves, Wind } from 'lucide-react'
import { DryingTimeline } from './components/DryingTimeline'
import { GaugeRing } from './components/GaugeRing'
import { Metric } from './components/Metric'
import { SearchBar } from './components/SearchBar'
import { WeeklyForecast } from './components/WeeklyForecast'
import { fetchForecast } from './lib/api'
import { cls } from './lib/utils'
import type { Forecast, Place, VerdictKey } from './types'

const DEFAULT_PLACE: Place = { name: 'Manila', country: 'Philippines', latitude: 14.5995, longitude: 120.9842 }
const PLACE_STORAGE_KEY = 'maglalaba-ba:place'

function loadSavedPlace(): Place {
  try {
    const raw = localStorage.getItem(PLACE_STORAGE_KEY)
    if (!raw) return DEFAULT_PLACE
    const saved: unknown = JSON.parse(raw)
    if (
      saved &&
      typeof saved === 'object' &&
      typeof (saved as Place).name === 'string' &&
      typeof (saved as Place).latitude === 'number' &&
      typeof (saved as Place).longitude === 'number'
    ) {
      return saved as Place
    }
  } catch {
    // ignore corrupt storage and fall back to the default place
  }
  return DEFAULT_PLACE
}

interface ThemeMeta {
  bg: string
  text: string
  icon: ReactNode
  accent: string
}

export default function App() {
  const [place, setPlace] = useState(loadSavedPlace)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let alive = true
    fetchForecast(place)
      .then((data) => {
        if (alive) setForecast(data)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error && err.message ? err.message : 'Forecast failed')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setSearchLoading(false)
      })
    return () => {
      alive = false
    }
  }, [place, retryToken])

  useEffect(() => {
    try {
      localStorage.setItem(PLACE_STORAGE_KEY, JSON.stringify(place))
    } catch {
      // storage may be unavailable (private mode, quota); the app works without it
    }
  }, [place])

  const theme: VerdictKey = forecast?.verdict.key ?? 'maybe'
  const verdictIsForTomorrow = Boolean(forecast?.timeline.length && new Date(forecast.timeline[0].time).toDateString() !== new Date().toDateString())
  const themeMeta = useMemo<Record<VerdictKey, ThemeMeta>>(
    () => ({
      sunny: {
        bg: 'theme-sunny',
        text: 'text-ink',
        icon: <Sun size={74} />,
        accent:
          'bg-[radial-gradient(circle_at_72%_5%,rgba(80,217,254,.45),transparent_28%),radial-gradient(circle_at_10%_8%,rgba(255,193,7,.34),transparent_26%)]'
      },
      maybe: {
        bg: 'theme-maybe',
        text: 'text-ink',
        icon: (
          <div className="flex items-center gap-3">
            <Sun size={64} />
            <Cloud size={58} />
          </div>
        ),
        accent:
          'bg-[radial-gradient(circle_at_72%_5%,rgba(255,193,7,.28),transparent_28%),radial-gradient(circle_at_10%_8%,rgba(120,138,165,.35),transparent_28%)]'
      },
      rainy: {
        bg: 'theme-rainy',
        text: 'text-ink',
        icon: <CloudRain size={74} />,
        accent:
          'bg-[radial-gradient(circle_at_72%_5%,rgba(96,110,138,.35),transparent_30%),radial-gradient(circle_at_10%_8%,rgba(80,217,254,.18),transparent_26%)]'
      }
    }),
    []
  )

  function choosePlace(nextPlace: Place) {
    setSearchLoading(true)
    setLoading(true)
    setError('')
    setPlace(nextPlace)
  }

  function retry() {
    setLoading(true)
    setError('')
    setRetryToken((token) => token + 1)
  }

  function onSearchError(message: string) {
    setError(message)
    setLoading(false)
    setSearchLoading(false)
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        choosePlace({
          name: 'Your spot',
          country: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      () => {
        setError('Location permission was blocked')
        setSearchLoading(false)
      }
    )
  }

  return (
    <main className={cls('min-h-screen overflow-hidden transition-colors duration-700', themeMeta[theme].bg, themeMeta[theme].text)}>
      <div className="fixed inset-0 -z-10">
        <div className={cls('absolute inset-0 transition-opacity duration-700', themeMeta[theme].accent)} />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/20 backdrop-blur-3xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Shirt className="h-6 w-6 text-current sm:h-7 sm:w-7" />
            <h1 className="min-w-0 text-xl font-extrabold text-current sm:text-2xl md:text-3xl">Maglalaba ba?</h1>
          </div>
          <SearchBar busy={searchLoading} onSelect={choosePlace} onError={onSearchError} onUseLocation={handleUseLocation} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-5 sm:py-6 md:space-y-5 md:px-8 md:py-8">
        <section className="hero-glass rounded-3xl p-4 text-center sm:p-6 md:rounded-[2rem] md:p-10">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-sky sm:text-sm sm:tracking-[0.16em]">
            <MapPin size={17} />
            {[place.name, place.country].filter(Boolean).join(', ')}
          </div>

          {loading ? (
            <div className="grid min-h-96 place-items-center">
              <RefreshCw className="animate-spin text-aqua" size={48} />
            </div>
          ) : error ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-red-50/80 p-5 text-red-800">
              <AlertCircle className="mx-auto mb-2" />
              <p>{error}</p>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-300 bg-white/80 px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-white"
                onClick={retry}
                type="button"
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          ) : forecast ? (
            <>
              <div className={cls('mx-auto mb-3 flex scale-75 justify-center sm:scale-100', theme === 'rainy' ? 'text-sky' : 'text-gold')}>
                {themeMeta[theme].icon}
              </div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-70">{verdictIsForTomorrow ? 'Verdict para bukas' : 'Current verdict'}</p>
              <h2 className="mx-auto mt-2 max-w-full text-[clamp(2.15rem,13vw,4.5rem)] font-extrabold leading-none md:text-7xl">{forecast.verdict.label}</h2>
              <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-snug sm:text-lg md:text-2xl">{forecast.verdict.line}</p>
              {forecast.verdict.reasons.length > 0 && (
                <div className="mx-auto mt-5 max-w-3xl rounded-2xl border border-white/35 bg-white/20 p-4 text-left shadow-xl backdrop-blur sm:p-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-70">Bakit ganyan ang verdict?</p>
                  <div className="mt-3 grid gap-2">
                    {forecast.verdict.reasons.map((reason) => (
                      <p key={reason} className="rounded-xl bg-white/25 px-3 py-2 text-sm font-semibold leading-snug text-ink/80 sm:text-base">
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:gap-4 md:mt-8 md:grid-cols-[1.15fr_.85fr]">
                <div className="glass-card rounded-2xl p-4 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">Drying power</p>
                  <GaugeRing score={forecast.score} theme={theme} />
                  <p className="mx-auto mt-2 inline-flex max-w-full rounded-full bg-aqua/20 px-3 py-2 text-center text-xs font-extrabold text-sky sm:px-4 sm:text-sm">
                    {forecast.verdict.chip}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <Metric icon={<Thermometer />} label="Temp" value={`${Math.round(forecast.current.temperature_2m)}°C`} />
                  <Metric icon={<Droplets />} label="Humidity" value={`${Math.round(forecast.current.relative_humidity_2m)}%`} />
                  <Metric icon={<Wind />} label="Wind" value={`${Math.round(forecast.current.wind_speed_10m)} km/h`} />
                  <Metric icon={<Waves />} label="Avg rain risk" value={`${forecast.rainChance}%`} />
                </div>
              </div>
            </>
          ) : null}
        </section>

        {forecast && !loading && (
          <>
            <DryingTimeline hours={forecast.timeline} />
            <WeeklyForecast days={forecast.daily} />
          </>
        )}
      </div>
    </main>
  )
}
