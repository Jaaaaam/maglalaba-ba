import { Gauge } from 'lucide-react'
import { cls } from '../lib/utils'
import type { DayForecast } from '../types'
import { WeatherIcon } from './WeatherIcon'

export function WeeklyForecast({ days }: { days: DayForecast[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 px-1 sm:px-2">
        <Gauge className="text-aqua" />
        <h3 className="text-xl font-bold sm:text-2xl">Weekly Forecast</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
        {days.map((day, index) => (
          <article key={day.time} className="glass-card rounded-2xl p-3 text-center sm:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">
              {index === 0 ? 'Today' : new Date(day.time).toLocaleDateString([], { weekday: 'short' })}
            </p>
            <div
              className={cls(
                'mx-auto my-3 flex justify-center',
                day.verdict.key === 'rainy' ? 'text-red-500' : day.verdict.key === 'sunny' ? 'text-sun' : 'text-aqua'
              )}
            >
              <WeatherIcon code={day.code} size={30} />
            </div>
            <p className="text-l font-extrabold sm:text-xl">{day.verdict.short}</p>
            <p className="mt-2 text-[11px] font-semibold leading-snug opacity-70 sm:text-xs">
              {day.tempMax}°C · {day.rainChance}% rain
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
