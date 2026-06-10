import { describe, expect, it } from 'vitest'
import { AVERAGE_DRYING_HOURS, getBestLaundryWindow, unpackForecast, type OpenMeteoResponse } from './forecast'
import { makeHour } from './test-helpers'

function localTime(base: Date, hourOfDay: number) {
  const date = new Date(base)
  date.setHours(hourOfDay, 0, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date
}

describe('getBestLaundryWindow', () => {
  it('avoids the rainy morning and picks the dry afternoon', () => {
    const day = tomorrow()
    const hours = Array.from({ length: 11 }, (_, index) => {
      const hourOfDay = 7 + index
      const rainy = hourOfDay <= 11
      return makeHour({
        time: localTime(day, hourOfDay),
        weather_code: rainy ? 63 : 0,
        precipitation: rainy ? 2 : 0,
        precipitation_probability: rainy ? 90 : 5
      })
    })

    const window = getBestLaundryWindow(hours, new Date())
    expect(window).toHaveLength(AVERAGE_DRYING_HOURS)
    for (const hour of window) {
      expect(hour.precipitation).toBe(0)
      expect(hour.weather_code).toBe(0)
    }
  })

  it('only considers daylight hours of a single day', () => {
    const day = tomorrow()
    const hours = Array.from({ length: 24 }, (_, hourOfDay) => makeHour({ time: localTime(day, hourOfDay) }))
    const window = getBestLaundryWindow(hours, new Date())
    for (const hour of window) {
      const hourOfDay = new Date(hour.time).getHours()
      expect(hourOfDay).toBeGreaterThanOrEqual(7)
      expect(hourOfDay).toBeLessThanOrEqual(17)
    }
  })
})

describe('unpackForecast', () => {
  it('produces a sunny verdict and a full timeline from an all-clear forecast', () => {
    const day = tomorrow()
    const hourly = Array.from({ length: 24 }, (_, hourOfDay) => makeHour({ time: localTime(day, hourOfDay) }))
    const data: OpenMeteoResponse = {
      current: {
        time: localTime(new Date(), new Date().getHours()),
        temperature_2m: 33,
        relative_humidity_2m: 55,
        precipitation: 0,
        weather_code: 0,
        wind_speed_10m: 14
      },
      hourly: {
        time: hourly.map((hour) => hour.time),
        temperature_2m: hourly.map((hour) => hour.temperature_2m),
        relative_humidity_2m: hourly.map((hour) => hour.relative_humidity_2m),
        precipitation_probability: hourly.map((hour) => hour.precipitation_probability),
        precipitation: hourly.map((hour) => hour.precipitation),
        weather_code: hourly.map((hour) => hour.weather_code),
        wind_speed_10m: hourly.map((hour) => hour.wind_speed_10m),
        uv_index: hourly.map((hour) => hour.uv_index)
      },
      daily: {
        time: [localTime(new Date(), 0).slice(0, 10), localTime(day, 0).slice(0, 10)],
        weather_code: [0, 0],
        temperature_2m_max: [33, 34],
        temperature_2m_min: [25, 25],
        precipitation_sum: [0, 0],
        precipitation_probability_max: [5, 5],
        uv_index_max: [9, 9],
        wind_speed_10m_max: [15, 15]
      }
    }

    const forecast = unpackForecast(data)
    expect(forecast.verdict.key).toBe('sunny')
    expect(forecast.timeline).toHaveLength(AVERAGE_DRYING_HOURS)
    expect(forecast.daily).toHaveLength(2)
    expect(forecast.daily.every((dayForecast) => dayForecast.verdict.key === 'sunny')).toBe(true)
    expect(forecast.current.temperature_2m).toBe(33)
    expect(forecast.score).toBeGreaterThan(50)
  })

  it('does not mark a later day HINDI when it still has a dry morning drying window', () => {
    const dayOne = tomorrow()
    const dayTwo = new Date(dayOne)
    dayTwo.setDate(dayTwo.getDate() + 1)

    const clearDay = Array.from({ length: 11 }, (_, index) => makeHour({ time: localTime(dayOne, 7 + index) }))
    const mixedDay = Array.from({ length: 11 }, (_, index) => {
      const hourOfDay = 7 + index
      const stormy = hourOfDay >= 11
      return makeHour({
        time: localTime(dayTwo, hourOfDay),
        weather_code: stormy ? 95 : 0,
        precipitation: stormy ? 3 : 0,
        precipitation_probability: stormy ? 90 : 5
      })
    })
    const hourly = [...clearDay, ...mixedDay]
    const data: OpenMeteoResponse = {
      hourly: {
        time: hourly.map((hour) => hour.time),
        temperature_2m: hourly.map((hour) => hour.temperature_2m),
        relative_humidity_2m: hourly.map((hour) => hour.relative_humidity_2m),
        precipitation_probability: hourly.map((hour) => hour.precipitation_probability),
        precipitation: hourly.map((hour) => hour.precipitation),
        weather_code: hourly.map((hour) => hour.weather_code),
        wind_speed_10m: hourly.map((hour) => hour.wind_speed_10m),
        uv_index: hourly.map((hour) => hour.uv_index)
      },
      daily: {
        // day two's aggregates look terrible (storm code, 90% max rain, 21 mm) even though its morning is clear
        time: [localTime(dayOne, 0).slice(0, 10), localTime(dayTwo, 0).slice(0, 10)],
        weather_code: [0, 95],
        temperature_2m_max: [33, 33],
        temperature_2m_min: [25, 25],
        precipitation_sum: [0, 21],
        precipitation_probability_max: [5, 90],
        uv_index_max: [9, 9],
        wind_speed_10m_max: [15, 15]
      }
    }

    const forecast = unpackForecast(data)
    expect(forecast.daily).toHaveLength(2)
    expect(forecast.daily[0].verdict.key).toBe('sunny')
    expect(forecast.daily[1].verdict.key).not.toBe('rainy')
  })

  it('keeps HINDI for a later day that is wet across every drying window', () => {
    const dayOne = tomorrow()
    const dayTwo = new Date(dayOne)
    dayTwo.setDate(dayTwo.getDate() + 1)

    const clearDay = Array.from({ length: 11 }, (_, index) => makeHour({ time: localTime(dayOne, 7 + index) }))
    const wetDay = Array.from({ length: 11 }, (_, index) =>
      makeHour({
        time: localTime(dayTwo, 7 + index),
        weather_code: 63,
        precipitation: 2,
        precipitation_probability: 95
      })
    )
    const hourly = [...clearDay, ...wetDay]
    const data: OpenMeteoResponse = {
      hourly: {
        time: hourly.map((hour) => hour.time),
        temperature_2m: hourly.map((hour) => hour.temperature_2m),
        relative_humidity_2m: hourly.map((hour) => hour.relative_humidity_2m),
        precipitation_probability: hourly.map((hour) => hour.precipitation_probability),
        precipitation: hourly.map((hour) => hour.precipitation),
        weather_code: hourly.map((hour) => hour.weather_code),
        wind_speed_10m: hourly.map((hour) => hour.wind_speed_10m),
        uv_index: hourly.map((hour) => hour.uv_index)
      },
      daily: {
        time: [localTime(dayOne, 0).slice(0, 10), localTime(dayTwo, 0).slice(0, 10)],
        weather_code: [0, 63],
        temperature_2m_max: [33, 29],
        temperature_2m_min: [25, 24],
        precipitation_sum: [0, 22],
        precipitation_probability_max: [5, 95],
        uv_index_max: [9, 3],
        wind_speed_10m_max: [15, 10]
      }
    }

    const forecast = unpackForecast(data)
    expect(forecast.daily[1].verdict.key).toBe('rainy')
  })

  it('treats null precipitation values as zero', () => {
    const day = tomorrow()
    const hourly = Array.from({ length: 12 }, (_, index) => makeHour({ time: localTime(day, 7 + index) }))
    const data: OpenMeteoResponse = {
      hourly: {
        time: hourly.map((hour) => hour.time),
        temperature_2m: hourly.map((hour) => hour.temperature_2m),
        relative_humidity_2m: hourly.map((hour) => hour.relative_humidity_2m),
        precipitation_probability: hourly.map(() => null),
        precipitation: hourly.map(() => null),
        weather_code: hourly.map((hour) => hour.weather_code),
        wind_speed_10m: hourly.map((hour) => hour.wind_speed_10m),
        uv_index: hourly.map(() => null)
      },
      daily: {
        time: [localTime(day, 0).slice(0, 10)],
        weather_code: [0],
        temperature_2m_max: [33],
        temperature_2m_min: [25],
        precipitation_sum: [null],
        precipitation_probability_max: [null],
        uv_index_max: [null],
        wind_speed_10m_max: [null]
      }
    }

    const forecast = unpackForecast(data)
    expect(forecast.rainChance).toBe(0)
    expect(forecast.timeline.every((hour) => hour.precipitation === 0)).toBe(true)
  })
})
