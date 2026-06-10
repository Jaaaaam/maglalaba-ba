import { describe, expect, it } from 'vitest'
import { getHourVerdict, scoreHour } from './forecast'
import { makeHour } from './test-helpers'
import { verdictFromScore } from './verdict'

describe('getHourVerdict', () => {
  it('says OO for a sunny dry hour', () => {
    expect(getHourVerdict(makeHour()).key).toBe('sunny')
  })

  it('says HINDI when it is meaningfully raining right now', () => {
    const hour = makeHour({ weather_code: 63, precipitation: 1.5, precipitation_probability: 90 })
    expect(getHourVerdict(hour).key).toBe('rainy')
  })

  it('says SIGURO for partly cloudy skies', () => {
    expect(getHourVerdict(makeHour({ weather_code: 2 })).key).toBe('maybe')
  })

  it('says SIGURO when a wet code only carries low rain risk and no actual rain', () => {
    const hour = makeHour({ weather_code: 61, precipitation: 0, precipitation_probability: 40 })
    expect(getHourVerdict(hour).key).toBe('maybe')
  })

  it('does not flip to HINDI on high rain probability alone while it stays dry', () => {
    const hour = makeHour({ weather_code: 2, precipitation: 0, precipitation_probability: 95 })
    expect(getHourVerdict(hour).key).toBe('maybe')
  })
})

describe('verdictFromScore without current conditions (daily cards)', () => {
  it('says HINDI for a wet code with high rain chance', () => {
    expect(verdictFromScore(40, 90, 63).key).toBe('rainy')
  })

  it('says OO for a clear day', () => {
    expect(verdictFromScore(80, 10, 0).key).toBe('sunny')
  })

  it('always explains a HINDI verdict with one to three reasons', () => {
    const verdict = verdictFromScore(20, 95, 65, {
      current: makeHour({ weather_code: 65, precipitation: 3, precipitation_probability: 95 }),
      averageRain: 90,
      precipitationTotal: 6,
      wetHours: 3,
      windowHours: 4
    })
    expect(verdict.key).toBe('rainy')
    expect(verdict.reasons.length).toBeGreaterThanOrEqual(1)
    expect(verdict.reasons.length).toBeLessThanOrEqual(3)
  })
})

describe('scoreHour', () => {
  it('stays within 0-100', () => {
    const extremes = [
      makeHour({ temperature_2m: 45, relative_humidity_2m: 10, wind_speed_10m: 60, uv_index: 12 }),
      makeHour({
        temperature_2m: 5,
        relative_humidity_2m: 100,
        wind_speed_10m: 0,
        uv_index: 0,
        precipitation: 20,
        precipitation_probability: 100,
        weather_code: 65
      })
    ]
    for (const hour of extremes) {
      const score = scoreHour(hour)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('ranks a hot dry sunny hour above a humid rainy hour', () => {
    const sunny = scoreHour(makeHour())
    const rainy = scoreHour(makeHour({ weather_code: 63, precipitation: 2, precipitation_probability: 90, relative_humidity_2m: 92, uv_index: 1 }))
    expect(sunny).toBeGreaterThan(rainy)
  })
})
