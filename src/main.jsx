import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AlertCircle,
  Cloud,
  CloudRain,
  Droplets,
  Gauge,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  Shirt,
  Sun,
  Thermometer,
  Timer,
  Waves,
  Wind
} from 'lucide-react'
import './styles.css'

const DEFAULT_PLACE = { name: 'Manila', country: 'Philippines', latitude: 14.5995, longitude: 120.9842 }

const WMO = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm'
}

function cls(...parts) {
  return parts.filter(Boolean).join(' ')
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function uvLabel(uv = 0) {
  if (uv >= 8) return 'Very high'
  if (uv >= 6) return 'High'
  if (uv >= 3) return 'Medium'
  return 'Low'
}

function isWetCode(code) {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)
}

function weatherIcon(code, size = 34) {
  if (isWetCode(code)) return <CloudRain size={size} />
  if ([2, 3, 45, 48].includes(code)) return <Cloud size={size} />
  return <Sun size={size} />
}

function scoreHour(hour) {
  const tempScore = clamp((hour.temperature_2m - 22) * 5, 0, 35)
  const humidityScore = clamp((88 - hour.relative_humidity_2m) * 0.75, 0, 30)
  const windScore = clamp(hour.wind_speed_10m * 1.4, 0, 22)
  const uvScore = clamp(hour.uv_index * 5, 0, 25)
  const rainPenalty = clamp(hour.precipitation_probability * 0.95 + hour.precipitation * 22, 0, 80)
  const codePenalty = isWetCode(hour.weather_code) ? 28 : hour.weather_code === 3 ? 10 : 0
  return Math.round(clamp(18 + tempScore + humidityScore + windScore + uvScore - rainPenalty - codePenalty, 0, 100))
}

function verdictFromScore(score, rainChance, code) {
  if (score >= 72 && rainChance < 35 && !isWetCode(code)) {
    return {
      key: 'sunny',
      label: 'OO / GO',
      chip: 'Sampay confidence: main character',
      line: 'Maaraw, mahangin, at mukhang kakampi ang langit. Ilabas ang labada, pero huwag kalimutan ang sipit.',
      short: 'OO'
    }
  }

  if (score >= 40 && rainChance < 70) {
    return {
      key: 'maybe',
      label: 'SIGURO / MAYBE',
      chip: 'Bantayan mo ang sampay, bes',
      line: 'The sun is trying its best, pero may konting drama sa ulap department. Puwede, basta alerto.',
      short: 'SIGURO'
    }
  }

  return {
    key: 'rainy',
    label: 'HINDI / NO',
    chip: 'Itabi ang sabon. Kape muna.',
    line: 'Malakas ang chance na maliligo ulit ang nilabhan mo. Today is not the labada Olympics.',
    short: 'HINDI'
  }
}

function getLaundryWindow(hours, now) {
  const futureDaylight = hours.filter((hour) => {
    const date = new Date(hour.time)
    const hourOfDay = date.getHours()
    return date >= now && hourOfDay >= 7 && hourOfDay <= 17
  })

  if (!futureDaylight.length) {
    return hours.filter((hour) => new Date(hour.time) >= now).slice(0, 10)
  }

  const targetDay = new Date(futureDaylight[0].time).toDateString()
  return futureDaylight.filter((hour) => new Date(hour.time).toDateString() === targetDay)
}

function unpackForecast(data) {
  const now = new Date()
  const hours = data.hourly.time.map((time, index) => ({
    time,
    temperature_2m: data.hourly.temperature_2m[index],
    relative_humidity_2m: data.hourly.relative_humidity_2m[index],
    precipitation_probability: data.hourly.precipitation_probability[index] ?? 0,
    precipitation: data.hourly.precipitation[index] ?? 0,
    wind_speed_10m: data.hourly.wind_speed_10m[index],
    uv_index: data.hourly.uv_index[index] ?? 0,
    weather_code: data.hourly.weather_code[index]
  }))

  const future = hours.filter((hour) => new Date(hour.time) >= now)
  const current = future[0] ?? hours[0]
  const laundryWindow = getLaundryWindow(hours, now)
  const averageScore = Math.round(laundryWindow.reduce((sum, hour) => sum + scoreHour(hour), 0) / laundryWindow.length)
  const worstRain = Math.max(...laundryWindow.map((hour) => hour.precipitation_probability))
  const wettest = laundryWindow.reduce((max, hour) => (hour.precipitation_probability > max.precipitation_probability ? hour : max), laundryWindow[0])
  const verdict = verdictFromScore(averageScore, worstRain, wettest?.weather_code ?? current.weather_code)

  const daily = data.daily.time.map((time, index) => {
    const rainChance = data.daily.precipitation_probability_max[index] ?? 0
    const score = Math.round(
      clamp(
        35 +
          (data.daily.temperature_2m_max[index] - 24) * 4 +
          (data.daily.uv_index_max[index] ?? 0) * 5 +
          (data.daily.wind_speed_10m_max[index] ?? 0) * 0.8 -
          rainChance * 0.8 -
          (data.daily.precipitation_sum[index] ?? 0) * 18,
        0,
        100
      )
    )
    const verdict = verdictFromScore(score, rainChance, data.daily.weather_code[index])
    return {
      time,
      score,
      verdict,
      code: data.daily.weather_code[index],
      rainChance,
      tempMax: Math.round(data.daily.temperature_2m_max[index])
    }
  })

  return {
    current,
    score: averageScore,
    rainChance: worstRain,
    timeline: laundryWindow.filter((_, index) => index % 2 === 0).slice(0, 5),
    daily,
    verdict
  }
}

async function fetchForecast(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: 'auto',
    forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max'
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error('Open-Meteo forecast request failed')
  return unpackForecast(await res.json())
}

async function searchPlace(query) {
  const params = new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!res.ok) throw new Error('Could not search that city')
  const data = await res.json()
  if (!data.results?.length) throw new Error('No matching city found')
  const place = data.results[0]
  return {
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude
  }
}

function GaugeRing({ score, theme }) {
  const circumference = 251.2
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="relative flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
      <svg className="-rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" className="text-white/25" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={`url(#${theme}-gradient)`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="10"
        />
        <defs>
          <linearGradient id={`${theme}-gradient`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor={theme === 'rainy' ? '#50d9fe' : '#00677d'} />
            <stop offset="100%" stopColor={theme === 'sunny' ? '#ffc107' : '#50d9fe'} />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-3xl font-extrabold sm:text-4xl">{score}%</span>
    </div>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="glass-card min-h-28 rounded-2xl p-3 text-center sm:min-h-32 sm:p-4">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center text-aqua sm:h-9 sm:w-9">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-[0.05em] opacity-70">{label}</p>
      <p className="mt-1 max-w-full break-words text-xl font-bold leading-tight sm:text-2xl">{value}</p>
    </div>
  )
}

function App() {
  const [place, setPlace] = useState(DEFAULT_PLACE)
  const [forecast, setForecast] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetchForecast(place)
      .then((data) => alive && setForecast(data))
      .catch((err) => alive && setError(err.message || 'Forecast failed'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [place])

  const theme = forecast?.verdict.key ?? 'maybe'
  const current = forecast?.current
  const themeMeta = useMemo(
    () => ({
      sunny: {
        bg: 'theme-sunny',
        text: 'text-ink',
        icon: <Sun size={74} />,
        photo: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=2400'
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
        photo: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=2400'
      },
      rainy: {
        bg: 'theme-rainy',
        text: 'text-white',
        icon: <CloudRain size={74} />,
        photo: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=2400'
      }
    }),
    []
  )

  async function onSearch(event) {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      setPlace(await searchPlace(query.trim()))
      setQuery('')
    } catch (err) {
      setError(err.message || 'Search failed')
      setLoading(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setPlace({
          name: 'Your spot',
          country: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
      () => setError('Location permission was blocked')
    )
  }

  return (
    <main className={cls('min-h-screen overflow-hidden transition-colors duration-700', themeMeta[theme].bg, themeMeta[theme].text)}>
      <div className="fixed inset-0 -z-10">
        <img src={themeMeta[theme].photo} alt="" className="h-full w-full object-cover opacity-35 mix-blend-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_5%,rgba(80,217,254,.45),transparent_28%),radial-gradient(circle_at_10%_8%,rgba(255,193,7,.34),transparent_26%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/20 backdrop-blur-3xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Shirt className="h-6 w-6 text-current sm:h-7 sm:w-7" />
            <h1 className="min-w-0 text-xl font-extrabold text-current sm:text-2xl md:text-3xl">Maglalaba ba?</h1>
          </div>
          <form onSubmit={onSearch} className="grid min-w-0 grid-cols-[1fr_auto_auto] gap-2 md:flex md:flex-1 md:justify-end md:max-w-lg">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search city"
                className="w-full rounded-full border border-white/40 bg-white/45 py-3 pl-10 pr-4 text-sm font-semibold text-ink outline-none backdrop-blur-xl placeholder:text-ink/50 focus:border-sun"
              />
            </label>
            <button className="icon-button" aria-label="Search city" type="submit">
              <Search size={19} />
            </button>
            <button className="icon-button" aria-label="Use my location" type="button" onClick={useMyLocation}>
              <LocateFixed size={19} />
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-5 sm:py-6 md:space-y-5 md:px-8 md:py-8">
        <section className="hero-glass rounded-3xl p-4 text-center sm:p-6 md:rounded-[2rem] md:p-10">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-sky sm:text-sm sm:tracking-[0.16em]">
            <MapPin size={17} />
            {place.name}, {place.country}
          </div>

          {loading ? (
            <div className="grid min-h-96 place-items-center">
              <RefreshCw className="animate-spin text-aqua" size={48} />
            </div>
          ) : error ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-red-50/80 p-5 text-red-800">
              <AlertCircle className="mx-auto mb-2" />
              {error}
            </div>
          ) : (
            <>
              <div className={cls('mx-auto mb-3 flex scale-75 justify-center sm:scale-100', theme === 'rainy' ? 'text-aqua' : 'text-gold')}>{themeMeta[theme].icon}</div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-70">Current verdict</p>
              <h2 className="mx-auto mt-2 max-w-full text-[clamp(2.15rem,13vw,4.5rem)] font-extrabold leading-none md:text-7xl">{forecast.verdict.label}</h2>
              <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-snug sm:text-lg md:text-2xl">{forecast.verdict.line}</p>

              <div className="mt-6 grid gap-3 sm:gap-4 md:mt-8 md:grid-cols-[1.15fr_.85fr]">
                <div className="glass-card rounded-2xl p-4 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">Drying power</p>
                  <GaugeRing score={forecast.score} theme={theme} />
                  <p className="mx-auto mt-2 inline-flex max-w-full rounded-full bg-aqua/20 px-3 py-2 text-center text-xs font-extrabold text-sky sm:px-4 sm:text-sm">{forecast.verdict.chip}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <Metric icon={<Thermometer />} label="Temp" value={`${Math.round(current.temperature_2m)}°C`} />
                  <Metric icon={<Droplets />} label="Humidity" value={`${Math.round(current.relative_humidity_2m)}%`} />
                  <Metric icon={<Wind />} label="Wind" value={`${Math.round(current.wind_speed_10m)} km/h`} />
                  <Metric icon={<Waves />} label="Rain chance" value={`${forecast.rainChance}%`} />
                </div>
              </div>
            </>
          )}
        </section>

        {forecast && !loading && (
          <>
            <section className="hero-glass rounded-3xl p-4 sm:p-5 md:rounded-[2rem] md:p-7">
              <div className="mb-5 flex items-center gap-3 md:mb-7">
                <Timer className="text-aqua" />
                <h3 className="text-xl font-bold sm:text-2xl">Drying Timeline</h3>
              </div>
              <div className="scroll-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0">
                {forecast.timeline.map((hour) => {
                  const score = scoreHour(hour)
                  const verdict = verdictFromScore(score, hour.precipitation_probability, hour.weather_code)
                  return (
                    <div key={hour.time} className="glass-card min-w-36 shrink-0 snap-start rounded-2xl p-3 text-center sm:p-4 md:min-w-0 md:shrink">
                      <div className={cls('mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full', verdict.key === 'rainy' ? 'bg-red-500/20 text-red-500' : 'bg-aqua/20 text-sky')}>
                        {weatherIcon(hour.weather_code, 23)}
                      </div>
                      <p className="text-sm font-extrabold">{new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="mt-1 text-xs font-semibold opacity-70">{WMO[hour.weather_code] ?? 'Weather'}</p>
                      <p className="mt-3 rounded-full bg-white/25 px-2 py-1 text-xs font-extrabold">{verdict.short}</p>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3 px-1 sm:px-2">
                <Gauge className="text-aqua" />
                <h3 className="text-xl font-bold sm:text-2xl">Weekly Forecast</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
                {forecast.daily.map((day, index) => (
                  <article key={day.time} className="glass-card rounded-2xl p-3 text-center sm:p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">
                      {index === 0 ? 'Today' : new Date(day.time).toLocaleDateString([], { weekday: 'short' })}
                    </p>
                    <div className={cls('mx-auto my-3 flex justify-center', day.verdict.key === 'rainy' ? 'text-red-500' : day.verdict.key === 'sunny' ? 'text-sun' : 'text-aqua')}>
                      {weatherIcon(day.code, 30)}
                    </div>
                    <p className="text-xl font-extrabold sm:text-2xl">{day.verdict.short}</p>
                    <p className="mt-2 text-[11px] font-semibold leading-snug opacity-70 sm:text-xs">{day.tempMax}°C · {day.rainChance}% rain</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
