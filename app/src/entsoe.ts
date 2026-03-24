export type SwedishZone = 'SE1' | 'SE2' | 'SE3' | 'SE4'

export type EntsoePricePoint = {
  zone: SwedishZone
  deliveryStartUtc: string
  deliveryEndUtc: string
  deliveryHourCet: number
  marketDateCet: string
  deliveryPeriodCet: string
  priceEurMwh: number
  resolution: string
}

export type EntsoeCrossBorderFlowPoint = {
  linkId: string
  from: string
  to: string
  deliveryStartUtc: string
  deliveryEndUtc: string
  marketDateCet: string
  deliveryPeriodCet: string
  flowMw: number
  resolution: string
}

type EntsoeWindow = {
  periodStart: Date
  periodEnd: Date
}

const ZONE_TO_EIC: Record<SwedishZone, string> = {
  SE1: '10Y1001A1001A44P',
  SE2: '10Y1001A1001A45N',
  SE3: '10Y1001A1001A46L',
  SE4: '10Y1001A1001A47J',
}

const cetDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const cetTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const cetZoneFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm',
  timeZoneName: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatApiDate(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  const hour = String(value.getUTCHours()).padStart(2, '0')
  const minute = String(value.getUTCMinutes()).padStart(2, '0')
  return `${year}${month}${day}${hour}${minute}`
}

export function buildEntsoeWindow(referenceDate = new Date()): EntsoeWindow {
  const todayStart = new Date(referenceDate)
  todayStart.setUTCHours(0, 0, 0, 0)
  
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1)
  
  return {
    periodStart: todayStart,
    periodEnd: tomorrowStart,
  }
}

function durationToMilliseconds(resolution: string): number {
  const hourMatch = resolution.match(/^PT(\d+)H$/)
  if (hourMatch) {
    return Number(hourMatch[1]) * 60 * 60 * 1000
  }

  const minuteMatch = resolution.match(/^PT(\d+)M$/)
  if (minuteMatch) {
    return Number(minuteMatch[1]) * 60 * 1000
  }

  throw new Error(`Unsupported ENTSO-E resolution: ${resolution}`)
}

function extractText(parent: Element, selector: string): string | null {
  return parent.querySelector(selector)?.textContent?.trim() ?? null
}

function ensureEntsoeToken(): string {
  const token = import.meta.env.VITE_ENTSOE_API_TOKEN as string | undefined
  if (!token) {
    throw new Error('Missing VITE_ENTSOE_API_TOKEN in local environment.')
  }

  return token
}

function buildDeliveryPeriod(start: Date, end: Date): { marketDateCet: string; deliveryPeriodCet: string } {
  const marketDateCet = cetDateFormatter.format(start)
  const zoneLabel = formatShortTimeZoneName(start)
  const deliveryPeriodCet = `${cetTimeFormatter.format(start)}-${cetTimeFormatter.format(end)} ${zoneLabel}`
  return { marketDateCet, deliveryPeriodCet }
}

async function fetchEntsoeXml(query: URLSearchParams): Promise<string> {
  const maxRetries = 3
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(`/entsoe-api/api?${query.toString()}`)
    if (response.ok) {
      return response.text()
    }
    if (attempt < maxRetries && (response.status === 503 || response.status === 429)) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
      continue
    }
    const documentType = query.get('documentType') ?? 'unknown'
    throw new Error(`ENTSO-E request failed for ${documentType} with status ${response.status}.`)
  }
  throw new Error('fetchEntsoeXml: unreachable')
}

function parseEntsoeDocument(xmlText: string): XMLDocument {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parserError = document.querySelector('parsererror')
  if (parserError) {
    throw new Error('ENTSO-E XML parsing failed.')
  }
  return document
}

function formatShortTimeZoneName(value: Date): string {
  const parts = cetZoneFormatter.formatToParts(value)
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'CET'
}

function getCetHour(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)

  return Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
}

function toPricePoint(zone: SwedishZone, start: Date, end: Date, resolution: string, priceValue: number): EntsoePricePoint {
  const { marketDateCet, deliveryPeriodCet } = buildDeliveryPeriod(start, end)

  return {
    zone,
    deliveryStartUtc: start.toISOString(),
    deliveryEndUtc: end.toISOString(),
    deliveryHourCet: getCetHour(start),
    marketDateCet,
    deliveryPeriodCet,
    priceEurMwh: priceValue,
    resolution,
  }
}

function parseEntsoePrices(zone: SwedishZone, xmlText: string): EntsoePricePoint[] {
  const document = parseEntsoeDocument(xmlText)

  const points: EntsoePricePoint[] = []
  const periods = [...document.querySelectorAll('TimeSeries Period')]

  for (const period of periods) {
    const startText = extractText(period, 'timeInterval > start')
    const resolution = extractText(period, 'resolution')
    if (!startText || !resolution) {
      continue
    }

    const periodStart = new Date(startText)
    const stepMs = durationToMilliseconds(resolution)

    for (const point of period.querySelectorAll('Point')) {
      const positionText = extractText(point, 'position')
      const priceText = extractText(point, 'price\\.amount') ?? extractText(point, 'price.amount')
      if (!positionText || !priceText) {
        continue
      }

      const position = Number(positionText)
      const priceValue = Number(priceText)
      if (!Number.isFinite(position) || !Number.isFinite(priceValue)) {
        continue
      }

      const slotStart = new Date(periodStart.getTime() + (position - 1) * stepMs)
      const slotEnd = new Date(slotStart.getTime() + stepMs)
      points.push(toPricePoint(zone, slotStart, slotEnd, resolution, priceValue))
    }
  }

  return points.sort((left, right) => left.deliveryStartUtc.localeCompare(right.deliveryStartUtc))
}

function parseDirectionalFlowSeries(xmlText: string): Map<string, { deliveryEndUtc: string; marketDateCet: string; deliveryPeriodCet: string; flowMw: number; resolution: string }> {
  const document = parseEntsoeDocument(xmlText)
  const points = new Map<string, { deliveryEndUtc: string; marketDateCet: string; deliveryPeriodCet: string; flowMw: number; resolution: string }>()

  for (const period of document.querySelectorAll('TimeSeries Period')) {
    const startText = extractText(period, 'timeInterval > start')
    const resolution = extractText(period, 'resolution')
    if (!startText || !resolution) {
      continue
    }

    const periodStart = new Date(startText)
    const stepMs = durationToMilliseconds(resolution)

    for (const point of period.querySelectorAll('Point')) {
      const positionText = extractText(point, 'position')
      const quantityText = extractText(point, 'quantity')
      if (!positionText || !quantityText) {
        continue
      }

      const position = Number(positionText)
      const flowMw = Number(quantityText)
      if (!Number.isFinite(position) || !Number.isFinite(flowMw)) {
        continue
      }

      const slotStart = new Date(periodStart.getTime() + (position - 1) * stepMs)
      const slotEnd = new Date(slotStart.getTime() + stepMs)
      const labels = buildDeliveryPeriod(slotStart, slotEnd)
      points.set(slotStart.toISOString(), {
        deliveryEndUtc: slotEnd.toISOString(),
        marketDateCet: labels.marketDateCet,
        deliveryPeriodCet: labels.deliveryPeriodCet,
        flowMw,
        resolution,
      })
    }
  }

  return points
}

async function fetchZonePrices(zone: SwedishZone, periodStart: Date, periodEnd: Date): Promise<EntsoePricePoint[]> {
  const token = ensureEntsoeToken()

  const params = new URLSearchParams({
    securityToken: token,
    documentType: 'A44',
    in_Domain: ZONE_TO_EIC[zone],
    out_Domain: ZONE_TO_EIC[zone],
    periodStart: formatApiDate(periodStart),
    periodEnd: formatApiDate(periodEnd),
  })

  const xmlText = await fetchEntsoeXml(params)
  const parsed = parseEntsoePrices(zone, xmlText)
  if (parsed.length === 0) {
    throw new Error(`ENTSO-E response did not include price points for ${zone}.`)
  }

  return parsed
}

async function fetchDirectionalPhysicalFlows(fromDomain: string, toDomain: string, periodStart: Date, periodEnd: Date): Promise<Map<string, { deliveryEndUtc: string; marketDateCet: string; deliveryPeriodCet: string; flowMw: number; resolution: string }>> {
  const token = ensureEntsoeToken()
  const params = new URLSearchParams({
    securityToken: token,
    documentType: 'A11',
    in_Domain: fromDomain,
    out_Domain: toDomain,
    periodStart: formatApiDate(periodStart),
    periodEnd: formatApiDate(periodEnd),
  })

  const xmlText = await fetchEntsoeXml(params)
  return parseDirectionalFlowSeries(xmlText)
}

export async function fetchSwedishEntsoePrices(): Promise<Record<SwedishZone, EntsoePricePoint[]>> {
  const { periodStart, periodEnd } = buildEntsoeWindow()
  const zones: SwedishZone[] = ['SE1', 'SE2', 'SE3', 'SE4']

  const results = await Promise.all(
    zones.map(async (zone) => [zone, await fetchZonePrices(zone, periodStart, periodEnd)] as const)
  )
  return Object.fromEntries(results) as Record<SwedishZone, EntsoePricePoint[]>
}

export async function fetchSwedishCrossBorderFlows(
  links: Array<{ id: string; from: string; to: string; fromDomain: string; toDomain: string }>,
): Promise<Record<string, EntsoeCrossBorderFlowPoint[]>> {
  const { periodStart, periodEnd } = buildEntsoeWindow()

  const results: Array<readonly [string, EntsoeCrossBorderFlowPoint[]]> = []
  for (const link of links) {
    const [forward, reverse] = await Promise.all([
      fetchDirectionalPhysicalFlows(link.fromDomain, link.toDomain, periodStart, periodEnd),
      fetchDirectionalPhysicalFlows(link.toDomain, link.fromDomain, periodStart, periodEnd),
    ])

    const timestamps = new Set<string>([...forward.keys(), ...reverse.keys()])
    const points = [...timestamps]
      .map((deliveryStartUtc) => {
        const forwardPoint = forward.get(deliveryStartUtc)
        const reversePoint = reverse.get(deliveryStartUtc)
        const samplePoint = forwardPoint ?? reversePoint
        if (!samplePoint) {
          return null
        }

        return {
          linkId: link.id,
          from: link.from,
          to: link.to,
          deliveryStartUtc,
          deliveryEndUtc: samplePoint.deliveryEndUtc,
          marketDateCet: samplePoint.marketDateCet,
          deliveryPeriodCet: samplePoint.deliveryPeriodCet,
          flowMw: (forwardPoint?.flowMw ?? 0) - (reversePoint?.flowMw ?? 0),
          resolution: samplePoint.resolution,
        }
      })
      .filter((point): point is EntsoeCrossBorderFlowPoint => point !== null)
      .sort((left, right) => left.deliveryStartUtc.localeCompare(right.deliveryStartUtc))

    results.push([link.id, points])
  }

  return Object.fromEntries(results)
}