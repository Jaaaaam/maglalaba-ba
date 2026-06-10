import type { Forecast, HourWeather, Verdict } from '../types'
import { clamp } from './utils'
import { verdictFromScore } from './verdict'
import { isWetCode } from './weather'

export const AVERAGE_DRYING_HOURS = 4

export interface OpenMeteoResponse {
  current?: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    precipitation?: number
    weather_code: number
    wind_speed_10m: number
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    precipitation_probability: Array<number | null>
    precipitation: Array<number | null>
    weather_code: number[]
    wind_speed_10m: number[]
    uv_index: Array<number | null>
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: Array<number | null>
    precipitation_probability_max: Array<number | null>
    uv_index_max: Array<number | null>
    wind_speed_10m_max: Array<number | null>
  }
}

export function scoreHour(hour: HourWeather) {
  const tempScore = clamp((hour.temperature_2m - 23) * 4.2, 0, 30)
  const humidityScore = clamp((86 - hour.relative_humidity_2m) * 0.55, 0, 24)
  const windScore = clamp(hour.wind_speed_10m * 1.2, 0, 18)
  const uvScore = clamp(hour.uv_index * 4, 0, 18)
  const rainPenalty = clamp(hour.precipitation_probability * 0.45 + hour.precipitation * 16, 0, 55)
  const codePenalty = isWetCode(hour.weather_code) ? 14 : hour.weather_code === 3 ? 5 : 0
  return Math.round(clamp(22 + tempScore + humidityScore + windScore + uvScore - rainPenalty - codePenalty, 0, 100))
}

function isWetHour(hour: HourWeather) {
  return isWetCode(hour.weather_code) || hour.precipitation >= 0.2
}

function summarizeLaundryWindow(window: HourWeather[]) {
  const averageScore = Math.round(window.reduce((sum, hour) => sum + scoreHour(hour), 0) / window.length)
  const worstRain = Math.max(...window.map((hour) => hour.precipitation_probability))
  const averageRain = Math.round(window.reduce((sum, hour) => sum + hour.precipitation_probability, 0) / window.length)
  const wetHours = window.filter(isWetHour).length
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

export function getHourVerdict(hour: HourWeather): Verdict {
  return verdictFromScore(scoreHour(hour), hour.precipitation_probability, hour.weather_code, {
    averageRain: hour.precipitation_probability,
    current: hour,
    precipitationTotal: hour.precipitation,
    wetHours: isWetHour(hour) ? 1 : 0,
    windowHours: 1
  })
}

function getLaundryWindow(hours: HourWeather[], now: Date) {
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

function rankWindow(summary: ReturnType<typeof summarizeLaundryWindow>) {
  return summary.averageScore - summary.averageRain * 0.18 - summary.wetHours * 8 - summary.precipitationTotal * 12
}

function bestWindowAmong(possibleHours: HourWeather[]) {
  const windowLength = Math.min(AVERAGE_DRYING_HOURS, possibleHours.length)

  if (windowLength <= 1) {
    return possibleHours
  }

  const windows = possibleHours.map((_, index) => possibleHours.slice(index, index + windowLength)).filter((window) => window.length === windowLength)

  return windows.reduce((bestWindow, window) =>
    rankWindow(summarizeLaundryWindow(window)) > rankWindow(summarizeLaundryWindow(bestWindow)) ? window : bestWindow
  )
}

export function getBestLaundryWindow(hours: HourWeather[], now: Date) {
  return bestWindowAmong(getLaundryWindow(hours, now))
}

function getDayWindowVerdict(daylightHours: HourWeather[]): Verdict {
  const window = bestWindowAmong(daylightHours)
  const summary = summarizeLaundryWindow(window)

  return verdictFromScore(summary.averageScore, summary.worstRain, summary.wettest.weather_code, {
    averageRain: summary.averageRain,
    current: summary.wettest,
    precipitationTotal: summary.precipitationTotal,
    wetHours: summary.wetHours,
    windowHours: summary.windowHours
  })
}

export function unpackForecast(data: OpenMeteoResponse): Forecast {
  const now = new Date()
  const hours: HourWeather[] = data.hourly.time.map((time, index) => ({
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
  const current: HourWeather = data.current
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

  const heroWindowDay = laundryWindow[0]?.time.slice(0, 10)

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
    const daylightHours = hours.filter((hour) => {
      if (!hour.time.startsWith(time)) return false
      const hourOfDay = Number(hour.time.slice(11, 13))
      return hourOfDay >= 7 && hourOfDay <= 17
    })
    const dayVerdict =
      time === heroWindowDay
        ? verdict
        : daylightHours.length
          ? getDayWindowVerdict(daylightHours)
          : verdictFromScore(score, rainChance, code, {
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
      verdict: dayVerdict,
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
