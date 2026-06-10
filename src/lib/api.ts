import type { Forecast, Place } from '../types'
import { unpackForecast, type OpenMeteoResponse } from './forecast'

interface GeocodingResponse {
  results?: Array<{
    id: number
    name: string
    admin1?: string
    country?: string
    latitude: number
    longitude: number
  }>
}

export async function fetchForecast(place: Place): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: 'auto',
    forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max'
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error('Open-Meteo forecast request failed')
  return unpackForecast((await res.json()) as OpenMeteoResponse)
}

export async function searchPlaces(query: string, count = 6, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ name: query, count: String(count), language: 'en', format: 'json' })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!res.ok) throw new Error('Could not search that city')
  const data = (await res.json()) as GeocodingResponse
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

export async function searchPlace(query: string): Promise<Place> {
  const results = await searchPlaces(query, 1)
  if (!results.length) throw new Error('No matching city found')
  return results[0]
}
