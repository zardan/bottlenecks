import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ArcLayer, GeoJsonLayer, TextLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Color, PickingInfo } from '@deck.gl/core'
import { CROSS_BORDER_LINKS, ZONE_LABELS, ZONES_GEOJSON } from './grid-data'
import type { ZoneFeatureProperties } from './grid-data'
import { fetchSwedishCrossBorderFlows, fetchSwedishEntsoePrices } from './entsoe'
import type { EntsoePricePoint, SwedishZone } from './entsoe'
import type { FlowArc, FlowState, HoverInfo, PriceState } from './types'
import './app.css'

const BASE_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
}

const SWEDISH_ZONES: SwedishZone[] = ['SE1', 'SE2', 'SE3', 'SE4']

function flowColors(selected: boolean): { source: [number, number, number, number]; target: [number, number, number, number] } {
  if (selected) {
    return {
      source: [0, 88, 154, 245],
      target: [28, 138, 200, 245],
    }
  }

  return {
    source: [40, 116, 177, 155],
    target: [83, 170, 214, 155],
  }
}

export function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)

  const [selectedZone, setSelectedZone] = useState<SwedishZone>('SE3')
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null)
  const [selectedDeliveryStartUtc, setSelectedDeliveryStartUtc] = useState<string>('')
  const [priceState, setPriceState] = useState<PriceState>({ status: 'loading', fetchedAt: null, seriesByZone: null, error: null })
  const [flowState, setFlowState] = useState<FlowState>({ status: 'loading', fetchedAt: null, seriesByLink: null, error: null })

  useEffect(() => {
    let cancelled = false

    const loadEntsoeData = async () => {
      setPriceState({ status: 'loading', fetchedAt: null, seriesByZone: null, error: null })
      setFlowState({ status: 'loading', fetchedAt: null, seriesByLink: null, error: null })

      const fetchedAt = new Date().toISOString()
      const [priceResult, flowResult] = await Promise.allSettled([
        fetchSwedishEntsoePrices(),
        fetchSwedishCrossBorderFlows(CROSS_BORDER_LINKS),
      ])

      if (cancelled) {
        return
      }

      if (priceResult.status === 'fulfilled') {
        setPriceState({ status: 'ready', fetchedAt, seriesByZone: priceResult.value, error: null })
      } else {
        setPriceState({
          status: 'error',
          fetchedAt: null,
          seriesByZone: null,
          error: priceResult.reason instanceof Error ? priceResult.reason.message : 'Unexpected ENTSO-E price fetch error.',
        })
      }

      if (flowResult.status === 'fulfilled') {
        setFlowState({ status: 'ready', fetchedAt, seriesByLink: flowResult.value, error: null })
      } else {
        setFlowState({
          status: 'error',
          fetchedAt: null,
          seriesByLink: null,
          error: flowResult.reason instanceof Error ? flowResult.reason.message : 'Unexpected ENTSO-E flow fetch error.',
        })
      }
    }

    void loadEntsoeData()

    return () => {
      cancelled = true
    }
  }, [])

  const deliveryOptions = useMemo(() => {
    if (priceState.status !== 'ready') {
      return []
    }

    const countByPeriod = new Map<string, number>()
    const samplePointByPeriod = new Map<string, EntsoePricePoint>()

    for (const zone of SWEDISH_ZONES) {
      for (const point of priceState.seriesByZone[zone]) {
        countByPeriod.set(point.deliveryStartUtc, (countByPeriod.get(point.deliveryStartUtc) ?? 0) + 1)
        if (!samplePointByPeriod.has(point.deliveryStartUtc)) {
          samplePointByPeriod.set(point.deliveryStartUtc, point)
        }
      }
    }

    return [...countByPeriod.entries()]
      .filter(([, count]) => count === SWEDISH_ZONES.length)
      .map(([deliveryStartUtc]) => samplePointByPeriod.get(deliveryStartUtc))
      .filter((point): point is EntsoePricePoint => point !== undefined)
      .sort((left, right) => left.deliveryStartUtc.localeCompare(right.deliveryStartUtc))
  }, [priceState])

  useEffect(() => {
    if (deliveryOptions.length === 0) {
      return
    }

    if (deliveryOptions.some((option) => option.deliveryStartUtc === selectedDeliveryStartUtc)) {
      return
    }

    const now = Date.now()
    const currentOrNext = deliveryOptions.find((option) => {
      const start = new Date(option.deliveryStartUtc).getTime()
      const end = new Date(option.deliveryEndUtc).getTime()
      return start <= now && now < end
    })

    const fallback = currentOrNext ?? deliveryOptions.find((option) => new Date(option.deliveryStartUtc).getTime() >= now) ?? deliveryOptions[deliveryOptions.length - 1]
    setSelectedDeliveryStartUtc(fallback.deliveryStartUtc)
  }, [deliveryOptions, selectedDeliveryStartUtc])

  const selectedPeriod = useMemo(() => {
    return deliveryOptions.find((option) => option.deliveryStartUtc === selectedDeliveryStartUtc) ?? null
  }, [deliveryOptions, selectedDeliveryStartUtc])

  const priceByZone = useMemo(() => {
    if (priceState.status !== 'ready' || !selectedPeriod) {
      return new Map<SwedishZone, EntsoePricePoint>()
    }

    return new Map<SwedishZone, EntsoePricePoint>(
      SWEDISH_ZONES.flatMap((zone) => {
        const point = priceState.seriesByZone[zone].find((candidate) => candidate.deliveryStartUtc === selectedPeriod.deliveryStartUtc)
        return point ? [[zone, point] as const] : []
      }),
    )
  }, [priceState, selectedPeriod])

  const activeFlows = useMemo<FlowArc[]>(() => {
    if (flowState.status !== 'ready' || !selectedPeriod) {
      return []
    }

    return CROSS_BORDER_LINKS.flatMap((link) => {
      const point = flowState.seriesByLink[link.id]?.find((candidate) => candidate.deliveryStartUtc === selectedPeriod.deliveryStartUtc)
      if (!point) {
        return []
      }

      return [{
        id: link.id,
        from: link.from,
        to: link.to,
        fromPosition: link.fromPosition,
        toPosition: link.toPosition,
        flowMw: point.flowMw,
        deliveryPeriodCet: point.deliveryPeriodCet,
        marketDateCet: point.marketDateCet,
      }]
    })
  }, [flowState, selectedPeriod])

  const maxVisibleFlow = useMemo(() => {
    return activeFlows.reduce((max, line) => Math.max(max, Math.abs(line.flowMw)), 1)
  }, [activeFlows])

  const selectedZoneStats = useMemo(() => {
    const zone = ZONES_GEOJSON.features.find((feature) => feature.properties.id === selectedZone)?.properties
    const currentPrice = priceByZone.get(selectedZone)?.priceEurMwh ?? zone?.basePriceEurMwh ?? null
    const connectedLines = activeFlows.filter((line) => line.from === selectedZone || line.to === selectedZone)
    const netCrossBorderMw = connectedLines.reduce((sum, line) => {
      if (line.from === selectedZone) {
        return sum - line.flowMw
      }
      return sum + line.flowMw
    }, 0)

    return {
      zone,
      currentPrice,
      connectedCount: connectedLines.length,
      netCrossBorderMw,
      strongestFlowMw: connectedLines.reduce((max, line) => Math.max(max, Math.abs(line.flowMw)), 0),
    }
  }, [activeFlows, priceByZone, selectedZone])

  const layers = useMemo(() => {
    return [
      new GeoJsonLayer<ZoneFeatureProperties>({
        id: 'zone-polygons',
        data: ZONES_GEOJSON,
        pickable: true,
        stroked: true,
        filled: true,
        getLineColor: (feature): Color => (feature.properties.id === selectedZone ? [80, 147, 201, 255] : [120, 129, 144, 225]),
        getLineWidth: (feature) => (feature.properties.id === selectedZone ? 3.5 : 1.4),
        lineWidthMinPixels: 1,
        getFillColor: (feature): Color => {
          const isSelected = feature.properties.id === selectedZone
          if (feature.properties.kind === 'neighbor') {
            return [225, 230, 236, 145]
          }

          return isSelected ? [173, 218, 249, 235] : [219, 225, 232, 180]
        },
        updateTriggers: {
          getFillColor: selectedZone,
          getLineColor: selectedZone,
          getLineWidth: selectedZone,
        },
        onHover: (info: PickingInfo<GeoJSON.Feature<GeoJSON.Polygon, ZoneFeatureProperties>>) => {
          if (info.object && info.x !== undefined && info.y !== undefined) {
            setHoverInfo({ kind: 'zone', x: info.x, y: info.y, zone: info.object.properties })
            return
          }

          setHoverInfo((current) => (current?.kind === 'zone' ? null : current))
        },
      }),
      new ArcLayer<FlowArc>({
        id: 'cross-border-flows',
        data: activeFlows,
        pickable: true,
        getSourcePosition: (line) => (line.flowMw >= 0 ? line.fromPosition : line.toPosition),
        getTargetPosition: (line) => (line.flowMw >= 0 ? line.toPosition : line.fromPosition),
        getSourceColor: (line) => flowColors(line.from === selectedZone || line.to === selectedZone).source,
        getTargetColor: (line) => flowColors(line.from === selectedZone || line.to === selectedZone).target,
        getWidth: (line) => 2 + (Math.abs(line.flowMw) / maxVisibleFlow) * 10,
        updateTriggers: {
          getSourceColor: selectedZone,
          getTargetColor: selectedZone,
        },
        widthMinPixels: 2,
        greatCircle: false,
        onHover: (info: PickingInfo<FlowArc>) => {
          if (info.object && info.x !== undefined && info.y !== undefined) {
            setHoverInfo({ kind: 'flow', x: info.x, y: info.y, line: info.object })
            return
          }

          setHoverInfo((current) => (current?.kind === 'flow' ? null : current))
        },
      }),
      new TextLayer({
        id: 'zone-labels',
        data: ZONE_LABELS,
        pickable: false,
        getPosition: (label) => label.position,
        getText: (label) => label.text,
        getSize: 16,
        getColor: [17, 24, 39, 250],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: [0, 0],
        outlineWidth: 2,
        outlineColor: [245, 246, 250, 245],
      }),
    ]
  }, [activeFlows, maxVisibleFlow, selectedZone])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    if (!mapRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: BASE_MAP_STYLE,
        center: [18.0, 60.5],
        zoom: 3.6,
        minZoom: 3,
        maxZoom: 7,
        pitchWithRotate: false,
        dragRotate: false,
      })

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')

      const overlay = new MapboxOverlay({ interleaved: true, layers })
      map.addControl(overlay)

      mapRef.current = map
      overlayRef.current = overlay
      return
    }

    overlayRef.current?.setProps({ layers })
  }, [layers])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        overlayRef.current = null
      }
    }
  }, [])

  const tooltipStyle = hoverInfo
    ? { left: `${hoverInfo.x + 16}px`, top: `${hoverInfo.y + 16}px` }
    : undefined
  const selectedDeliveryIndex = deliveryOptions.findIndex((opt) => opt.deliveryStartUtc === selectedDeliveryStartUtc)

  return (
    <main class="layout">
      <section class="controls-section">
        <div class="controls-container">
          <div class="heading-area">
            <h1>Nordic Grid Bottlenecks</h1>
            <p>Real ENTSO-E day-ahead prices and cross-border physical flows</p>
          </div>

          <div class="controls-grid">
            <div class="control-group">
              <label htmlFor="time-slider">
                <span class="control-label">Time (CET/CEST)</span>
              </label>
              <div class="time-slider-wrapper">
                <div class="slider-controls">
                  <button
                    type="button"
                    class="slider-arrow"
                    onClick={() => {
                      if (selectedDeliveryIndex > 0) {
                        setSelectedDeliveryStartUtc(deliveryOptions[selectedDeliveryIndex - 1].deliveryStartUtc)
                      }
                    }}
                    disabled={deliveryOptions.length === 0 || selectedDeliveryIndex <= 0}
                    aria-label="Previous delivery period"
                  >
                    {'<'}
                  </button>

                  <div class="slider-wrapper">
                    <input
                      id="time-slider"
                      type="range"
                      min="0"
                      max={Math.max(0, deliveryOptions.length - 1)}
                      value={Math.max(0, selectedDeliveryIndex)}
                      onChange={(event) => {
                        const idx = Number(event.currentTarget.value)
                        if (idx >= 0 && idx < deliveryOptions.length) {
                          setSelectedDeliveryStartUtc(deliveryOptions[idx].deliveryStartUtc)
                        }
                      }}
                      disabled={deliveryOptions.length === 0}
                      class="time-slider"
                    />

                    <div class="slider-ticks" aria-hidden="true">
                      {deliveryOptions.map((option, idx) => (
                        <span
                          key={option.deliveryStartUtc}
                          class={`slider-tick ${idx === selectedDeliveryIndex ? 'active' : ''}`}
                          style={{ left: `${deliveryOptions.length > 1 ? (idx / (deliveryOptions.length - 1)) * 100 : 0}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    class="slider-arrow"
                    onClick={() => {
                      if (selectedDeliveryIndex >= 0 && selectedDeliveryIndex < deliveryOptions.length - 1) {
                        setSelectedDeliveryStartUtc(deliveryOptions[selectedDeliveryIndex + 1].deliveryStartUtc)
                      }
                    }}
                    disabled={deliveryOptions.length === 0 || selectedDeliveryIndex >= deliveryOptions.length - 1}
                    aria-label="Next delivery period"
                  >
                    {'>'}
                  </button>
                </div>

                <div class="time-display">
                  <div class="time-info">
                    <span class="time-label">Market date</span>
                    <span class="time-value">{selectedPeriod?.marketDateCet ?? 'Loading...'}</span>
                  </div>
                  <div class="time-info">
                    <span class="time-label">Delivery hour (CET/CEST)</span>
                    <span class="time-value">{selectedPeriod?.deliveryPeriodCet ?? 'Loading...'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="control-group">
              <label class="control-label">Bidding zone</label>
              <div class="zone-picker-inline" role="radiogroup" aria-label="Select bidding zone">
                {SWEDISH_ZONES.map((id) => (
                  <button type="button" key={id} class={`zone-btn ${selectedZone === id ? 'active' : ''}`} onClick={() => setSelectedZone(id)}>
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="fetch-status-bar">
          {priceState.status === 'loading' && <p class="notice">Loading prices...</p>}
          {priceState.status === 'error' && <p class="notice error">Prices unavailable: {priceState.error}</p>}
          {priceState.status === 'ready' && <p class="notice success">Prices fetched at {new Date(priceState.fetchedAt).toLocaleString('sv-SE')}</p>}
          {flowState.status === 'loading' && <p class="notice">Loading flows...</p>}
          {flowState.status === 'error' && <p class="notice error">Flows unavailable: {flowState.error}</p>}
          {flowState.status === 'ready' && <p class="notice success">Flows fetched at {new Date(flowState.fetchedAt).toLocaleString('sv-SE')}</p>}
      </div>

      <div class="main-content">
        <section class="map-section">
              <div ref={mapContainerRef} class="map" />
              {hoverInfo && (
                <aside class="tooltip" style={tooltipStyle}>
                  {hoverInfo.kind === 'zone' ? (
                    <>
                      <strong>{hoverInfo.zone.name}</strong>
                      <span>
                        ENTSO-E day-ahead price: {(priceByZone.get(hoverInfo.zone.id as SwedishZone)?.priceEurMwh ?? hoverInfo.zone.basePriceEurMwh).toFixed(2)} EUR/MWh
                      </span>
                      <span>Delivery period: {selectedPeriod?.deliveryPeriodCet ?? 'n/a'}</span>
                    </>
                  ) : (
                    <>
                      <strong>
                        {hoverInfo.line.flowMw >= 0 ? hoverInfo.line.from : hoverInfo.line.to} to {hoverInfo.line.flowMw >= 0 ? hoverInfo.line.to : hoverInfo.line.from}
                      </strong>
                      <span>ENTSO-E physical flow: {Math.abs(hoverInfo.line.flowMw).toFixed(0)} MW</span>
                      <span>{hoverInfo.line.deliveryPeriodCet}</span>
                    </>
                  )}
                </aside>
              )}
        </section>

        <section class="table-section">
          <div class="table-container">
            <section class="zone-price-panel">
              <h2>Selected Bidding Zone Price</h2>
              <div class="zone-price-content">
                <span class="zone-name">{selectedZone}</span>
                <span class="zone-price-value">{selectedZoneStats.currentPrice !== null ? `${selectedZoneStats.currentPrice.toFixed(2)} EUR/MWh` : 'n/a'}</span>
              </div>
            </section>

            <h2>Cross-border flows for verification</h2>
            {flowState.status === 'ready' && selectedDeliveryStartUtc ? (
              <table class="flows-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Flow (MW)</th>
                    <th>Delivery period</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFlows.map((arc) => (
                    <tr key={arc.id}>
                      <td>{arc.from}</td>
                      <td>{arc.to}</td>
                      <td class="numeric">{Math.abs(arc.flowMw).toFixed(0)}</td>
                      <td>{arc.deliveryPeriodCet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : flowState.status !== 'ready' ? (
              <p class="table-placeholder">Flows will appear here once data is loaded and a delivery period is selected.</p>
            ) : null}
            <div class="table-legend">
              <p><strong>Source:</strong> ENTSO-E Transparency Platform - Day-ahead prices (A44 document type) and physical cross-border flows (A11 document type).</p>
              <p><strong>Legend:</strong> Zone color follows price level. Arc width follows flow magnitude in MW. Arc direction follows the actual net cross-border direction.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
