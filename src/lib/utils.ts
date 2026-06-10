export function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
