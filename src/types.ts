export interface Place {
  id?: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

export interface HourWeather {
  time: string
  temperature_2m: number
  relative_humidity_2m: number
  precipitation_probability: number
  precipitation: number
  wind_speed_10m: number
  uv_index: number
  weather_code: number
}

export type VerdictKey = 'sunny' | 'maybe' | 'rainy'

export interface Verdict {
  key: VerdictKey
  label: string
  chip: string
  line: string
  reasons: string[]
  short: string
}

export interface DayForecast {
  time: string
  score: number
  verdict: Verdict
  code: number
  rainChance: number
  tempMax: number
}

export interface Forecast {
  current: HourWeather
  score: number
  rainChance: number
  timeline: HourWeather[]
  daily: DayForecast[]
  verdict: Verdict
}
