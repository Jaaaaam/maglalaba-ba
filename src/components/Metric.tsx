import type { ReactNode } from 'react'

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="glass-card min-h-28 rounded-2xl p-3 text-center sm:min-h-32 sm:p-4">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center text-aqua sm:h-9 sm:w-9">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-[0.05em] opacity-70">{label}</p>
      <p className="mt-1 max-w-full break-words text-xl font-bold leading-tight sm:text-2xl">{value}</p>
    </div>
  )
}
