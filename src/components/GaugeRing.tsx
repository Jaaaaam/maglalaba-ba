import type { VerdictKey } from '../types'

export function GaugeRing({ score, theme }: { score: number; theme: VerdictKey }) {
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
      <span className="absolute text-2xl font-extrabold sm:text-3xl">{score}%</span>
    </div>
  )
}
