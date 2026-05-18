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
const AVERAGE_DRYING_HOURS = 4

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

function isSunnyCode(code) {
  return [0, 1].includes(code)
}

function isPartlySunnyCode(code) {
  return [2, 3, 45, 48].includes(code)
}

function weatherIcon(code, size = 34) {
  if (isWetCode(code)) return <CloudRain size={size} />
  if (isPartlySunnyCode(code)) return <Cloud size={size} />
  return <Sun size={size} />
}

function scoreHour(hour) {
  const tempScore = clamp((hour.temperature_2m - 23) * 4.2, 0, 30)
  const humidityScore = clamp((86 - hour.relative_humidity_2m) * 0.55, 0, 24)
  const windScore = clamp(hour.wind_speed_10m * 1.2, 0, 18)
  const uvScore = clamp(hour.uv_index * 4, 0, 18)
  const rainPenalty = clamp(hour.precipitation_probability * 0.45 + hour.precipitation * 16, 0, 55)
  const codePenalty = isWetCode(hour.weather_code) ? 14 : hour.weather_code === 3 ? 5 : 0
  return Math.round(clamp(22 + tempScore + humidityScore + windScore + uvScore - rainPenalty - codePenalty, 0, 100))
}

function getVerdictReasons(verdictKey, details) {
  const reasons = []

  if (verdictKey === 'sunny') {
    if (details.averageRain >= 45 || details.worstRain >= 60) {
      reasons.push(`May rain chance later (${details.averageRain}% average risk), pero ngayon sunny ang bida. Sampay now, chismis with the clouds later.`)
    } else if (details.averageRain >= 25) {
      reasons.push(`Tiny rain subplot later (${details.averageRain}% average risk), so keep one eye on the sky while the clothes do their glow-up.`)
    }

    if (details.precipitationTotal > 0 && details.precipitationTotal <= 1) {
      reasons.push(`Expected rain is only ${details.precipitationTotal} mm in the drying window. The clouds are sending a memo, not a resignation letter.`)
    }
  }

  if (verdictKey === 'maybe') {
    if (details.partlySunnyNow) {
      reasons.push('Partly sunny siya: enough sun for hope, enough clouds for trust issues.')
    }

    if (details.hotDryNow) {
      reasons.push('Mainit at dry ngayon, so may laban ang sampay habang cooperative pa ang langit.')
    }

    if (details.averageRain >= 55) {
      reasons.push(`Average rain risk is ${details.averageRain}%, so may ulan subplot pero hindi pa siya final episode.`)
    } else if (details.averageRain >= 35) {
      reasons.push(`Average rain risk is ${details.averageRain}%, kaya puwede pa, basta ready kang sumilip sa bintana.`)
    } else {
      reasons.push(`Average rain risk is only ${details.averageRain}%, so the forecast is more side-eye than stop sign.`)
    }

    if (details.precipitationTotal <= 0.5) {
      reasons.push('Expected actual rain is tiny, meaning the clouds are mostly making threats.')
    } else if (details.wetHours > 0) {
      reasons.push(`${details.wetHours} wet-ish hour${details.wetHours === 1 ? '' : 's'} in the drying window, so keep the sipit squad on standby.`)
    }

    if (details.score < 50) {
      reasons.push('Drying power is not elite today, but it is not hopeless either.')
    }
  }

  if (verdictKey === 'rainy') {
    if (details.activeRainNow) {
      reasons.push('It is already raining or wet right now. The labada is not asking for a second bath.')
    }

    if (details.precipitationTotal >= 4) {
      reasons.push(`Expected rain adds up to ${details.precipitationTotal} mm in the drying window. That is not drizzle, that is a plot twist.`)
    }

    if (details.averageRain >= 78) {
      reasons.push(`Average rain risk is ${details.averageRain}%, so the forecast is basically clearing its throat ominously.`)
    }

    if (details.wetHours >= 2) {
      reasons.push(`${details.wetHours} wet hours are showing up in the drying window. Very uninvited behavior.`)
    }

    if (!reasons.length) {
      reasons.push('The drying score is too low for a confident sampay moment today.')
    }
  }

  return reasons.slice(0, 3)
}

function verdictFromScore(score, rainChance, code, context = {}) {
  const windowHours = context.windowHours ?? 0
  const averageRain = context.averageRain ?? rainChance
  const wetHours = context.wetHours ?? 0
  const precipitationTotal = context.precipitationTotal ?? 0
  const current = context.current
  const wetHourShare = windowHours ? wetHours / windowHours : 0
  const currentlyDry = current ? (current.precipitation ?? 0) <= 0.1 : !isWetCode(code)
  const currentCode = current?.weather_code ?? code
  const sunnyNow = currentlyDry && isSunnyCode(currentCode)
  const partlySunnyNow = currentlyDry && isPartlySunnyCode(currentCode)
  const hotDryNow = current ? currentlyDry && current.temperature_2m >= 29 && current.relative_humidity_2m <= 78 : false
  const activeRainNow = current ? isWetCode(current.weather_code) && (current.precipitation ?? 0) >= 0.2 : false
  const dailyWetRisk = !windowHours && isWetCode(code) && rainChance >= 80
  const noLaundry = activeRainNow || (!current && dailyWetRisk)
  const details = { activeRainNow, averageRain, hotDryNow, partlySunnyNow, precipitationTotal, score, wetHours, worstRain: rainChance }

  if (!noLaundry && sunnyNow) {
    return {
      key: 'sunny',
      label: 'OO / GO',
      chip: 'Sampay confidence: main character',
      line: 'Maaraw ngayon, so go na ang labada. Ilabas ang damit habang main character pa ang araw.',
      reasons: getVerdictReasons('sunny', details),
      short: 'OO'
    }
  }

  if (!noLaundry && (partlySunnyNow || hotDryNow)) {
    return {
      key: 'maybe',
      label: 'SIGURO / MAYBE',
      chip: 'May araw, may konting attitude',
      line: 'Partly sunny or hot enough to try, pero may cloud drama sa gilid. Puwede, basta bantay-sampay mode.',
      reasons: getVerdictReasons('maybe', details),
      short: 'SIGURO'
    }
  }

  if (!noLaundry && currentlyDry) {
    return {
      key: 'maybe',
      label: 'SIGURO / MAYBE',
      chip: 'Bantayan mo ang sampay, bes',
      line: 'The sun is trying its best, pero may konting drama sa ulap department. Puwede, basta alerto.',
      reasons: getVerdictReasons('maybe', details),
      short: 'SIGURO'
    }
  }

  return {
    key: 'rainy',
    label: 'HINDI / NO',
    chip: 'Itabi ang sabon. Kape muna.',
    line: 'Malakas ang chance na maliligo ulit ang nilabhan mo. Today is not the labada Olympics.',
    reasons: getVerdictReasons('rainy', details),
    short: 'HINDI'
  }
}

function summarizeLaundryWindow(window) {
  const averageScore = Math.round(window.reduce((sum, hour) => sum + scoreHour(hour), 0) / window.length)
  const worstRain = Math.max(...window.map((hour) => hour.precipitation_probability))
  const averageRain = Math.round(window.reduce((sum, hour) => sum + hour.precipitation_probability, 0) / window.length)
  const wetHours = window.filter((hour) => isWetCode(hour.weather_code) || hour.precipitation >= 0.2).length
  const precipitationTotal = Number(window.reduce((sum, hour) => sum + hour.precipitation, 0).toFixed(1))
  const wettest = window.reduce((max, hour) => (hour.precipitation_probability > max.precipitation_probability ? hour : max), window[0])

  return {
    averageScore,
    worstRain,
    averageRain,
    wetHours,
    precipitationTotal,
    wettest,
    windowHours: window.length
  }
}

function getHourVerdict(hour) {
  const score = scoreHour(hour)
  const wetHours = isWetCode(hour.weather_code) || hour.precipitation >= 0.2 ? 1 : 0

  return verdictFromScore(score, hour.precipitation_probability, hour.weather_code, {
    averageRain: hour.precipitation_probability,
    current: hour,
    precipitationTotal: hour.precipitation,
    wetHours,
    windowHours: 1
  })
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

function getBestLaundryWindow(hours, now) {
  const possibleHours = getLaundryWindow(hours, now)
  const windowLength = Math.min(AVERAGE_DRYING_HOURS, possibleHours.length)

  if (windowLength <= 1) {
    return possibleHours
  }

  const windows = possibleHours
    .map((_, index) => possibleHours.slice(index, index + windowLength))
    .filter((window) => window.length === windowLength)

  return windows.reduce((bestWindow, window) => {
    const best = summarizeLaundryWindow(bestWindow)
    const next = summarizeLaundryWindow(window)
    const bestRank = best.averageScore - best.averageRain * 0.18 - best.wetHours * 8 - best.precipitationTotal * 12
    const nextRank = next.averageScore - next.averageRain * 0.18 - next.wetHours * 8 - next.precipitationTotal * 12
    return nextRank > bestRank ? window : bestWindow
  }, windows[0])
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
  const nearestHour = future[0] ?? hours[0]
  const current = data.current
    ? {
        time: data.current.time,
        temperature_2m: data.current.temperature_2m,
        relative_humidity_2m: data.current.relative_humidity_2m,
        precipitation_probability: nearestHour?.precipitation_probability ?? 0,
        precipitation: data.current.precipitation ?? 0,
        wind_speed_10m: data.current.wind_speed_10m,
        uv_index: nearestHour?.uv_index ?? 0,
        weather_code: data.current.weather_code
      }
    : nearestHour
  const laundryWindow = getBestLaundryWindow(hours, now)
  const summary = summarizeLaundryWindow(laundryWindow)
  const verdict = verdictFromScore(summary.averageScore, summary.worstRain, summary.wettest?.weather_code ?? current.weather_code, {
    averageRain: summary.averageRain,
    current,
    precipitationTotal: summary.precipitationTotal,
    wetHours: summary.wetHours,
    windowHours: summary.windowHours
  })

  const daily = data.daily.time.map((time, index) => {
    const rainChance = data.daily.precipitation_probability_max[index] ?? 0
    const precipitationTotal = data.daily.precipitation_sum[index] ?? 0
    const code = data.daily.weather_code[index]
    const score = Math.round(
      clamp(
        35 +
          (data.daily.temperature_2m_max[index] - 24) * 4 +
          (data.daily.uv_index_max[index] ?? 0) * 5 +
          (data.daily.wind_speed_10m_max[index] ?? 0) * 0.8 -
          rainChance * 0.8 -
          precipitationTotal * 18,
        0,
        100
      )
    )
    const verdict = verdictFromScore(score, rainChance, code, {
      averageRain: rainChance,
      current: {
        weather_code: code,
        precipitation: precipitationTotal >= 1.5 ? 0.2 : 0,
        temperature_2m: data.daily.temperature_2m_max[index],
        relative_humidity_2m: 70
      },
      precipitationTotal,
      wetHours: isWetCode(code) && precipitationTotal >= 1.5 ? 2 : 0,
      windowHours: AVERAGE_DRYING_HOURS
    })
    return {
      time,
      score,
      verdict,
      code,
      rainChance,
      tempMax: Math.round(data.daily.temperature_2m_max[index])
    }
  })

  return {
    current,
    score: summary.averageScore,
    rainChance: summary.averageRain,
    timeline: laundryWindow,
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
  const results = await searchPlaces(query, 1)
  if (!results.length) throw new Error('No matching city found')
  return results[0]
}

async function searchPlaces(query, count = 6, signal) {
  const params = new URLSearchParams({ name: query, count: String(count), language: 'en', format: 'json' })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!res.ok) throw new Error('Could not search that city')
  const data = await res.json()
  if (signal?.aborted) return []
  return (data.results ?? []).map((place) => ({
    id: place.id,
    name: place.name,
    admin1: place.admin1,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude
  }))
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
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetchForecast(place)
      .then((data) => alive && setForecast(data))
      .catch((err) => alive && setError(err.message || 'Forecast failed'))
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setSearchLoading(false)
      })
    return () => {
      alive = false
    }
  }, [place])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setSuggestionsOpen(false)
      setSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(true)
      searchPlaces(trimmed, 6, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          setSuggestions(results)
          setSuggestionsOpen(true)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setSuggestions([])
          setSuggestionsOpen(false)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsLoading(false)
        })
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query])

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

  async function choosePlace(nextPlace) {
    setSearchLoading(true)
    setLoading(true)
    setError('')
    setSuggestionsOpen(false)
    setSuggestions([])
    setQuery('')
    setPlace(nextPlace)
  }

  async function onSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSearchLoading(true)
    try {
      await choosePlace(suggestions[0] ?? (await searchPlace(trimmed)))
    } catch (err) {
      setError(err.message || 'Search failed')
      setLoading(false)
      setSearchLoading(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchLoading(true)
        setLoading(true)
        setError('')
        setPlace({
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
            <div className="relative min-w-0 flex-1">
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={18} />
                <input
                  value={query}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => suggestions.length && setSuggestionsOpen(true)}
                  placeholder="Search city"
                  disabled={searchLoading}
                  className="w-full rounded-full border border-white/40 bg-white/45 py-3 pl-10 pr-10 text-sm font-semibold text-ink outline-none backdrop-blur-xl placeholder:text-ink/50 focus:border-sun disabled:cursor-wait disabled:opacity-75"
                />
                {(suggestionsLoading || searchLoading) && (
                  <RefreshCw className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky" />
                )}
              </label>
              {suggestionsOpen && (suggestions.length > 0 || suggestionsLoading) && (
                <div className="suggestions-panel absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/45 bg-white/85 text-left text-ink shadow-2xl backdrop-blur-2xl">
                  {suggestionsLoading && suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm font-semibold text-ink/60">Looking for that sampayan spot...</div>
                  ) : (
                    suggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.id}-${suggestion.latitude}-${suggestion.longitude}`}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sun/20 focus:bg-sun/20 focus:outline-none"
                        disabled={searchLoading}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choosePlace(suggestion)}
                        type="button"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-sky" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-extrabold">{suggestion.name}</span>
                          <span className="block truncate text-xs font-semibold text-ink/60">
                            {[suggestion.admin1, suggestion.country].filter(Boolean).join(', ')}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="icon-button" aria-label={searchLoading ? 'Searching city' : 'Search city'} disabled={searchLoading} type="submit">
              {searchLoading ? <RefreshCw className="animate-spin" size={19} /> : <Search size={19} />}
            </button>
            <button className="icon-button" aria-label="Use my location" disabled={searchLoading} type="button" onClick={useMyLocation}>
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
              {forecast.verdict.reasons?.length > 0 && (
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
                  <p className="mx-auto mt-2 inline-flex max-w-full rounded-full bg-aqua/20 px-3 py-2 text-center text-xs font-extrabold text-sky sm:px-4 sm:text-sm">{forecast.verdict.chip}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <Metric icon={<Thermometer />} label="Temp" value={`${Math.round(current.temperature_2m)}°C`} />
                  <Metric icon={<Droplets />} label="Humidity" value={`${Math.round(current.relative_humidity_2m)}%`} />
                  <Metric icon={<Wind />} label="Wind" value={`${Math.round(current.wind_speed_10m)} km/h`} />
                  <Metric icon={<Waves />} label="Avg rain risk" value={`${forecast.rainChance}%`} />
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
                  const verdict = getHourVerdict(hour)
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
