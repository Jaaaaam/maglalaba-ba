import type { HourWeather } from '../types'

const WMO: Record<number, string> = {
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

const WET_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]

export function isWetCode(code: number) {
  return WET_CODES.includes(code)
}

export function isSunnyCode(code: number) {
  return [0, 1].includes(code)
}

export function isPartlySunnyCode(code: number) {
  return [2, 3, 45, 48].includes(code)
}

export function weatherLabel(hour: HourWeather) {
  const label = WMO[hour.weather_code] ?? 'Weather'

  if (!isWetCode(hour.weather_code)) {
    return label
  }

  if (hour.precipitation >= 0.2) {
    return label
  }

  if (hour.precipitation_probability >= 80) {
    return `Possible ${label.toLowerCase()}`
  }

  return hour.temperature_2m >= 29 ? 'Hot and dry-ish' : 'Cloudy but dry-ish'
}
