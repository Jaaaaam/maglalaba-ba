import { Timer } from 'lucide-react'
import { getHourVerdict } from '../lib/forecast'
import { cls } from '../lib/utils'
import { weatherLabel } from '../lib/weather'
import type { HourWeather } from '../types'
import { WeatherIcon } from './WeatherIcon'

export function DryingTimeline({ hours }: { hours: HourWeather[] }) {
  return (
    <section className="hero-glass rounded-3xl p-4 sm:p-5 md:rounded-[2rem] md:p-7">
      <div className="mb-5 flex items-center gap-3 md:mb-7">
        <Timer className="text-aqua" />
        <h3 className="text-xl font-bold sm:text-2xl">Drying Timeline</h3>
      </div>
      <div className="scroll-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0">
        {hours.map((hour) => {
          const verdict = getHourVerdict(hour)
          return (
            <div key={hour.time} className="glass-card min-w-36 shrink-0 snap-start rounded-2xl p-3 text-center sm:p-4 md:min-w-0 md:shrink">
              <div
                className={cls(
                  'mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full',
                  verdict.key === 'rainy' ? 'bg-red-500/20 text-red-500' : 'bg-aqua/20 text-sky'
                )}
              >
                <WeatherIcon code={hour.weather_code} size={23} />
              </div>
              <p className="text-sm font-extrabold">{new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="mt-1 text-xs font-semibold opacity-70">{weatherLabel(hour)}</p>
              {hour.precipitation_probability >= 80 && <p className="mt-1 text-[11px] font-bold opacity-60">{hour.precipitation_probability}% rain risk</p>}
              <p className="mt-3 rounded-full bg-white/25 px-2 py-1 text-xs font-extrabold">{verdict.short}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
