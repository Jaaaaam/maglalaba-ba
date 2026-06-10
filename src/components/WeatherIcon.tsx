import { Cloud, CloudRain, Sun } from 'lucide-react'
import { isPartlySunnyCode, isWetCode } from '../lib/weather'

export function WeatherIcon({ code, size = 34 }: { code: number; size?: number }) {
  if (isWetCode(code)) return <CloudRain size={size} />
  if (isPartlySunnyCode(code)) return <Cloud size={size} />
  return <Sun size={size} />
}
