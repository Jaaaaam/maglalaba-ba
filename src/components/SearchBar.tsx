import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { LocateFixed, MapPin, RefreshCw, Search } from 'lucide-react'
import { searchPlace, searchPlaces } from '../lib/api'
import type { Place } from '../types'

interface SearchBarProps {
  busy: boolean
  onSelect: (place: Place) => void
  onError: (message: string) => void
  onUseLocation: () => void
}

export function SearchBar({ busy, onSelect, onError, onUseLocation }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const disabled = busy || pending

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(true)
      searchPlaces(trimmed, 6, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          setSuggestions(results)
          setSuggestionsOpen(true)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setSuggestions([])
          setSuggestionsOpen(false)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsLoading(false)
        })
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query])

  function clearSuggestions() {
    setSuggestions([])
    setSuggestionsOpen(false)
    setSuggestionsLoading(false)
  }

  function updateQuery(value: string) {
    setQuery(value)
    if (value.trim().length < 2) clearSuggestions()
  }

  function choosePlace(place: Place) {
    clearSuggestions()
    setQuery('')
    onSelect(place)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    if (suggestions[0]) {
      choosePlace(suggestions[0])
      return
    }
    setPending(true)
    try {
      choosePlace(await searchPlace(trimmed))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-[1fr_auto_auto] gap-2 md:flex md:flex-1 md:justify-end md:max-w-lg">
      <div className="relative min-w-0 flex-1">
        <label className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={18} />
          <input
            value={query}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => suggestions.length && setSuggestionsOpen(true)}
            placeholder="Search city"
            disabled={disabled}
            className="w-full rounded-full border border-white/40 bg-white/45 py-3 pl-10 pr-10 text-sm font-semibold text-ink outline-none backdrop-blur-xl placeholder:text-ink/50 focus:border-sun disabled:cursor-wait disabled:opacity-75"
          />
          {(suggestionsLoading || disabled) && (
            <RefreshCw className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky" />
          )}
        </label>
        {suggestionsOpen && (suggestions.length > 0 || suggestionsLoading) && (
          <div className="suggestions-panel absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/45 bg-white/85 text-left text-ink shadow-2xl backdrop-blur-2xl">
            {suggestionsLoading && suggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm font-semibold text-ink/60">Looking for that sampayan spot...</div>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.id}-${suggestion.latitude}-${suggestion.longitude}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sun/20 focus:bg-sun/20 focus:outline-none"
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choosePlace(suggestion)}
                  type="button"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-sky" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold">{suggestion.name}</span>
                    <span className="block truncate text-xs font-semibold text-ink/60">
                      {[suggestion.admin1, suggestion.country].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button className="icon-button" aria-label={disabled ? 'Searching city' : 'Search city'} disabled={disabled} type="submit">
        {disabled ? <RefreshCw className="animate-spin" size={19} /> : <Search size={19} />}
      </button>
      <button className="icon-button" aria-label="Use my location" disabled={disabled} type="button" onClick={onUseLocation}>
        <LocateFixed size={19} />
      </button>
    </form>
  )
}
