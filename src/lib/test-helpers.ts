import type { HourWeather } from '../types'

export function makeHour(overrides: Partial<HourWeather> = {}): HourWeather {
  return {
    time: '2026-06-11T10:00',
    temperature_2m: 32,
    relative_humidity_2m: 60,
    precipitation_probability: 10,
    precipitation: 0,
    wind_speed_10m: 12,
    uv_index: 7,
    weather_code: 0,
    ...overrides
  }
}
