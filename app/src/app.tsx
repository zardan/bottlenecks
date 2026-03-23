import { useMemo, useState } from 'preact/hooks'
import './app.css'

type Zone = 'SE1' | 'SE2' | 'SE3' | 'SE4'
type DataMode = 'live' | 'mock'

type SeriesPoint = {
  timestamp: string
  value: number
}

type DashboardData = {
  zone: Zone
  mode: DataMode
  pricePoints: SeriesPoint[]
  scbProductionGwh: number | null
  scbConsumptionGwh: number | null
  warnings: string[]
}

const ZONE_TO_EIC: Record<Zone, string> = {
  SE1: '10Y1001A1001A44P',
  SE2: '10Y1001A1001A45N',
  SE3: '10Y1001A1001A46L',
  SE4: '10Y1001A1001A47J',
}

const TODAY = new Date()
const START_UTC = formatEntsoeDate(new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate() - 1)))
const END_UTC = formatEntsoeDate(new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate() + 1)))

function formatEntsoeDate(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}0000`
}

function buildMockData(zone: Zone): DashboardData {
  const base = zone === 'SE1' ? 38 : zone === 'SE2' ? 42 : zone === 'SE3' ? 58 : 64
  const now = Date.now()
  const pricePoints = Array.from({ length: 8 }).map((_, idx) => ({
    timestamp: new Date(now - (7 - idx) * 15 * 60 * 1000).toISOString(),
    value: Number((base + Math.sin(idx) * 8 + idx).toFixed(2)),
  }))

  return {
    zone,
    mode: 'mock',
    pricePoints,
    scbProductionGwh: 5000 + (base - 30) * 10,
    scbConsumptionGwh: 3200 + (base - 30) * 11,
    warnings: ['Using mock data fallback while a live source is unavailable.'],
  }
}

function parseEntsoeResponse(text: string): SeriesPoint[] {
  // API can return XML wrapped in browser-rendered text, so we parse point blocks defensively.
  const matches = [...text.matchAll(/<Point>[\s\S]*?<position>(\d+)<\/position>[\s\S]*?<price\.amount>([-\d.]+)<\/price\.amount>[\s\S]*?<\/Point>/g)]
  const now = Date.now()

  return matches.slice(0, 16).map((match, idx) => ({
    timestamp: new Date(now - (16 - idx) * 15 * 60 * 1000).toISOString(),
    value: Number(match[2]),
  }))
}

async function fetchEntsoePrices(zone: Zone): Promise<SeriesPoint[]> {
  const token = import.meta.env.VITE_ENTSOE_API_TOKEN as string | undefined
  if (!token) {
    throw new Error('Missing VITE_ENTSOE_API_TOKEN in local environment.')
  }

  const eic = ZONE_TO_EIC[zone]
  const params = new URLSearchParams({
    securityToken: token,
    documentType: 'A44',
    in_Domain: eic,
    out_Domain: eic,
    periodStart: START_UTC,
    periodEnd: END_UTC,
  })

  const response = await fetch(`/entsoe-api/api?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`ENTSO-E request failed with status ${response.status}.`)
  }

  const text = await response.text()
  const points = parseEntsoeResponse(text)
  if (points.length === 0) {
    throw new Error('ENTSO-E response did not include price points.')
  }
  return points
}

async function fetchScbLatestMonthly(zone: Zone): Promise<{ production: number | null; consumption: number | null }> {
  const response = await fetch('/scb-api/api/v2/tables/TAB78/data?lang=en&outputFormat=json-stat2')
  if (!response.ok) {
    throw new Error(`SCB request failed with status ${response.status}.`)
  }

  const body = (await response.json()) as {
    value: number[]
    dimension: {
      ProdAnv: { category: { index: Record<string, number> } }
      Elomrade: { category: { index: Record<Zone, number> } }
    }
    size: [number, number, number, number]
  }

  const metricIndex = body.dimension.ProdAnv.category.index
  const zoneIndex = body.dimension.Elomrade.category.index[zone]
  const zoneCount = body.size[3]

  const at = (prodKey: string): number | null => {
    const prodIdx = metricIndex[prodKey]
    if (prodIdx === undefined || zoneIndex === undefined) {
      return null
    }
    const flattenedIndex = prodIdx * zoneCount + zoneIndex
    return body.value[flattenedIndex] ?? null
  }

  return {
    production: at('Produktion'),
    consumption: at('Användning'),
  }
}

export function App() {
  const [zone, setZone] = useState<Zone>('SE3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>(() => buildMockData('SE3'))

  const latestPrice = useMemo(() => data.pricePoints[data.pricePoints.length - 1]?.value ?? null, [data.pricePoints])

  const loadData = async (nextZone: Zone) => {
    setLoading(true)
    setError(null)
    try {
      const [prices, scb] = await Promise.all([fetchEntsoePrices(nextZone), fetchScbLatestMonthly(nextZone)])
      setData({
        zone: nextZone,
        mode: 'live',
        pricePoints: prices,
        scbProductionGwh: scb.production,
        scbConsumptionGwh: scb.consumption,
        warnings: [],
      })
    } catch (err) {
      const fallback = buildMockData(nextZone)
      setData(fallback)
      setError(err instanceof Error ? err.message : 'Unexpected fetch error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main class="container">
      <header class="header">
        <h1>Swedish bottleneck simulator (Phase 2 kickoff)</h1>
        <p>
          This first version verifies data adapters: ENTSO-E day-ahead prices + SCB monthly production/consumption.
        </p>
      </header>

      <section class="controls">
        <label for="zone">Bidding zone</label>
        <select
          id="zone"
          value={zone}
          onChange={(event) => {
            const next = event.currentTarget.value as Zone
            setZone(next)
          }}
        >
          <option value="SE1">SE1</option>
          <option value="SE2">SE2</option>
          <option value="SE3">SE3</option>
          <option value="SE4">SE4</option>
        </select>
        <button type="button" onClick={() => loadData(zone)} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch data'}
        </button>
      </section>

      <section class="status">
        <div>
          <strong>Zone:</strong> {data.zone}
        </div>
        <div>
          <strong>Mode:</strong> {data.mode}
        </div>
        <div>
          <strong>Latest price:</strong> {latestPrice !== null ? `${latestPrice} EUR/MWh` : 'n/a'}
        </div>
        <div>
          <strong>SCB production:</strong> {data.scbProductionGwh ?? 'n/a'} GWh
        </div>
        <div>
          <strong>SCB consumption:</strong> {data.scbConsumptionGwh ?? 'n/a'} GWh
        </div>
      </section>

      {error && (
        <p class="error">
          Live fetch failed: {error}
        </p>
      )}

      {data.warnings.length > 0 && (
        <ul class="warnings">
          {data.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <section class="series">
        <h2>Recent price points</h2>
        <table>
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>EUR/MWh</th>
            </tr>
          </thead>
          <tbody>
            {data.pricePoints.map((point) => (
              <tr key={point.timestamp}>
                <td>{point.timestamp}</td>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
