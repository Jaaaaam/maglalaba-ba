import type { Verdict, VerdictKey } from '../types'
import { isPartlySunnyCode, isSunnyCode, isWetCode } from './weather'

export interface CurrentConditions {
  weather_code: number
  precipitation: number
  temperature_2m: number
  relative_humidity_2m: number
  precipitation_probability?: number
}

export interface VerdictContext {
  windowHours?: number
  averageRain?: number
  wetHours?: number
  precipitationTotal?: number
  current?: CurrentConditions
}

interface VerdictDetails {
  activeRainNow: boolean
  averageRain: number
  hotDryNow: boolean
  partlySunnyNow: boolean
  precipitationTotal: number
  score: number
  wetHours: number
  worstRain: number
}

function getVerdictReasons(verdictKey: VerdictKey, details: VerdictDetails) {
  const reasons: string[] = []

  if (verdictKey === 'sunny') {
    if (details.averageRain >= 80 || details.worstRain >= 80) {
      reasons.push(`High rain risk later (${details.averageRain}% average risk), pero ngayon sunny ang bida. Sampay now, bantay lang mamaya.`)
    }

    if (details.precipitationTotal > 0 && details.precipitationTotal <= 1) {
      reasons.push(`Expected rain is only ${details.precipitationTotal} mm in the drying window. The clouds are sending a memo, not a resignation letter.`)
    }
  }

  if (verdictKey === 'maybe') {
    if (details.partlySunnyNow) {
      reasons.push('Partly sunny siya: enough sun for hope, enough clouds for trust issues.')
    }

    if (details.hotDryNow) {
      reasons.push('Mainit at dry ngayon, so may laban ang sampay habang cooperative pa ang langit.')
    }

    if (details.averageRain >= 80 || details.worstRain >= 80) {
      reasons.push(`Rain risk hits ${Math.max(details.averageRain, details.worstRain)}%, kaya bantay-sampay mode. Hindi panic, just adulting.`)
    } else {
      reasons.push(`Average rain risk is only ${details.averageRain}%, so the forecast is more side-eye than stop sign.`)
    }

    if (details.precipitationTotal <= 0.5) {
      reasons.push('Expected actual rain is tiny, meaning the clouds are mostly making threats.')
    } else if (details.wetHours > 0) {
      reasons.push(`${details.wetHours} wet-ish hour${details.wetHours === 1 ? '' : 's'} in the drying window, so keep the sipit squad on standby.`)
    }

    if (details.score < 50) {
      reasons.push('Drying power is not elite today, but it is not hopeless either.')
    }
  }

  if (verdictKey === 'rainy') {
    if (details.activeRainNow) {
      reasons.push('It is already raining or wet right now. The labada is not asking for a second bath.')
    }

    if (details.precipitationTotal >= 4) {
      reasons.push(`Expected rain adds up to ${details.precipitationTotal} mm in the drying window. That is not drizzle, that is a plot twist.`)
    }

    if (details.averageRain >= 78) {
      reasons.push(`Average rain risk is ${details.averageRain}%, so the forecast is basically clearing its throat ominously.`)
    }

    if (details.wetHours >= 2) {
      reasons.push(`${details.wetHours} wet hours are showing up in the drying window. Very uninvited behavior.`)
    }

    if (!reasons.length) {
      reasons.push('The drying score is too low for a confident sampay moment today.')
    }
  }

  return reasons.slice(0, 3)
}

export function verdictFromScore(score: number, rainChance: number, code: number, context: VerdictContext = {}): Verdict {
  const windowHours = context.windowHours ?? 0
  const averageRain = context.averageRain ?? rainChance
  const wetHours = context.wetHours ?? 0
  const precipitationTotal = context.precipitationTotal ?? 0
  const current = context.current
  const currentPrecipitation = current?.precipitation ?? 0
  const currentRainChance = current?.precipitation_probability ?? rainChance
  const meaningfulRainNow = currentPrecipitation >= 0.2 && currentRainChance >= 80
  const currentlyDry = current ? !meaningfulRainNow : !isWetCode(code) || rainChance < 80
  const currentCode = current?.weather_code ?? code
  const sunnyNow = currentlyDry && isSunnyCode(currentCode)
  const partlySunnyNow = currentlyDry && isPartlySunnyCode(currentCode)
  const hotDryNow = current ? currentlyDry && current.temperature_2m >= 29 && current.relative_humidity_2m <= 78 : false
  const rainRiskOnly = currentlyDry && isWetCode(currentCode) && currentRainChance < 80
  const activeRainNow = current ? isWetCode(current.weather_code) && meaningfulRainNow : false
  const dailyWetRisk = !windowHours && isWetCode(code) && rainChance >= 80
  const noLaundry = activeRainNow || (!current && dailyWetRisk)
  const details: VerdictDetails = { activeRainNow, averageRain, hotDryNow, partlySunnyNow, precipitationTotal, score, wetHours, worstRain: rainChance }

  if (!noLaundry && sunnyNow) {
    return {
      key: 'sunny',
      label: 'OO / GO',
      chip: 'Sampay confidence: main character',
      line: 'Maaraw ngayon, so go na ang labada. Ilabas ang damit habang main character pa ang araw.',
      reasons: getVerdictReasons('sunny', details),
      short: 'OO'
    }
  }

  if (!noLaundry && (partlySunnyNow || hotDryNow || rainRiskOnly)) {
    return {
      key: 'maybe',
      label: 'SIGURO / MAYBE',
      chip: 'May araw, may konting attitude',
      line: 'Partly sunny or hot enough to try, pero may cloud drama sa gilid. Puwede, basta bantay-sampay mode.',
      reasons: getVerdictReasons('maybe', details),
      short: 'SIGURO'
    }
  }

  if (!noLaundry && currentlyDry) {
    return {
      key: 'maybe',
      label: 'SIGURO / MAYBE',
      chip: 'Bantayan mo ang sampay, bes',
      line: 'The sun is trying its best, pero may konting drama sa ulap department. Puwede, basta alerto.',
      reasons: getVerdictReasons('maybe', details),
      short: 'SIGURO'
    }
  }

  return {
    key: 'rainy',
    label: 'HINDI / NO',
    chip: 'Itabi ang sabon. Kape muna.',
    line: 'Malakas ang chance na maliligo ulit ang nilabhan mo. Today is not the labada Olympics.',
    reasons: getVerdictReasons('rainy', details),
    short: 'HINDI'
  }
}
