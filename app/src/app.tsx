import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ArcLayer, GeoJsonLayer, TextLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Color, PickingInfo } from '@deck.gl/core'
import { FLOW_STEPS, INTERCONNECTORS, ZONE_LABELS, ZONES_GEOJSON } from './grid-data'
import type { ZoneFeatureProperties } from './grid-data'
import './app.css'

type FlowPoint = {
  id: string
  from: string
  to: string
  fromPosition: [number, number]
  toPosition: [number, number]
  capacityMw: number
  flowMw: number
  utilization: number
}

type HoverInfo =
  | {
      kind: 'zone'
      x: number
      y: number
  zone: ZoneFeatureProperties
    }
  | {
      kind: 'flow'
      x: number
      y: number
      line: FlowPoint
    }
  | null

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

function flowColor(utilization: number): [number, number, number, number] {
  if (utilization >= 0.9) {
    return [220, 38, 38, 235]
  }
  if (utilization >= 0.7) {
    return [245, 158, 11, 220]
  }
  return [14, 116, 144, 205]
}

export function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [selectedZone, setSelectedZone] = useState<string>('SE3')
  const [stepIndex, setStepIndex] = useState<number>(2)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null)

  const activeFlows = useMemo<FlowPoint[]>(() => {
    return INTERCONNECTORS.map((line) => {
      const flowMw = line.flowByStepMw[stepIndex]
      const utilization = Math.min(1, Math.abs(flowMw) / line.capacityMw)
      return {
        id: line.id,
        from: line.from,
        to: line.to,
        fromPosition: line.fromPosition,
        toPosition: line.toPosition,
        capacityMw: line.capacityMw,
        flowMw,
        utilization,
      }
    })
  }, [stepIndex])

  const selectedZoneStats = useMemo(() => {
    const zone = ZONES_GEOJSON.features.find((feature) => feature.properties.id === selectedZone)?.properties
    const connectedLines = activeFlows.filter((line) => line.from === selectedZone || line.to === selectedZone)
    const netInterconnectorMw = connectedLines.reduce((sum, line) => {
      if (line.from === selectedZone) {
        return sum - line.flowMw
      }
      return sum + line.flowMw
    }, 0)

    return {
      zone,
      connectedCount: connectedLines.length,
      netInterconnectorMw,
      highestUtilization: connectedLines.reduce((max, line) => Math.max(max, line.utilization), 0),
    }
  }, [activeFlows, selectedZone])

  const layers = useMemo(() => {
    return [
      new GeoJsonLayer<ZoneFeatureProperties>({
        id: 'zone-polygons',
        data: ZONES_GEOJSON,
        pickable: true,
        stroked: true,
        filled: true,
        getLineColor: [85, 93, 110, 235],
        lineWidthMinPixels: 1.5,
        getFillColor: (feature): Color => {
          const isSelected = feature.properties.id === selectedZone
          if (feature.properties.kind === 'neighbor') {
            const neighborColor: [number, number, number, number] = isSelected
              ? [197, 207, 224, 210]
              : [217, 223, 232, 165]
            return neighborColor
          }
          const base = feature.properties.basePriceEurMwh
          const intensity = Math.max(0, Math.min(1, (base - 40) / 40))
          const red = Math.round(44 + intensity * 160)
          const green = Math.round(182 - intensity * 95)
          const blue = Math.round(184 - intensity * 75)
          const swedenColor: [number, number, number, number] = isSelected
            ? [red + 25, green + 18, blue + 8, 225]
            : [red, green, blue, 170]
          return swedenColor
        },
        onHover: (info: PickingInfo<GeoJSON.Feature<GeoJSON.Polygon, ZoneFeatureProperties>>) => {
          if (info.object && info.x !== undefined && info.y !== undefined) {
            setHoverInfo({
              kind: 'zone',
              x: info.x,
              y: info.y,
              zone: info.object.properties,
            })
            return
          }
          setHoverInfo((current) => (current?.kind === 'zone' ? null : current))
        },
        onClick: (info: PickingInfo<GeoJSON.Feature<GeoJSON.Polygon, ZoneFeatureProperties>>) => {
          if (info.object) {
            setSelectedZone(info.object.properties.id)
          }
        },
      }),
      new ArcLayer<FlowPoint>({
        id: 'interconnector-flows',
        data: activeFlows,
        pickable: true,
        getSourcePosition: (line) => (line.flowMw >= 0 ? line.fromPosition : line.toPosition),
        getTargetPosition: (line) => (line.flowMw >= 0 ? line.toPosition : line.fromPosition),
        getSourceColor: (line) => {
          const emphasized = line.from === selectedZone || line.to === selectedZone
          const [r, g, b, a] = flowColor(line.utilization)
          return emphasized ? [r, g, b, a] : [r, g, b, 140]
        },
        getTargetColor: (line) => {
          const emphasized = line.from === selectedZone || line.to === selectedZone
          const [r, g, b, a] = flowColor(line.utilization)
          return emphasized ? [r, g, b, a] : [r, g, b, 140]
        },
        getWidth: (line) => 2 + line.utilization * 9,
        widthMinPixels: 2,
        greatCircle: false,
        onHover: (info: PickingInfo<FlowPoint>) => {
          if (info.object && info.x !== undefined && info.y !== undefined) {
            setHoverInfo({
              kind: 'flow',
              x: info.x,
              y: info.y,
              line: info.object,
            })
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
  }, [activeFlows, selectedZone])

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

      const overlay = new MapboxOverlay({
        interleaved: true,
        layers,
      })
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
    ? {
        left: `${hoverInfo.x + 16}px`,
        top: `${hoverInfo.y + 16}px`,
      }
    : undefined

  return (
    <main class="layout">
      <section class="map-shell">
        <div class="hud">
          <h1>Nordic Grid Bottlenecks</h1>
          <p>Prototype map for bidding zones, cross-border flows, and congestion headroom.</p>
          <label class="time-control" for="flow-step">
            <span>Flow snapshot: {FLOW_STEPS[stepIndex]} UTC</span>
            <input
              id="flow-step"
              type="range"
              min={0}
              max={FLOW_STEPS.length - 1}
              step={1}
              value={stepIndex}
              onInput={(event) => setStepIndex(Number(event.currentTarget.value))}
            />
          </label>
        </div>

        <div ref={mapContainerRef} class="map" />

        {hoverInfo && (
          <aside class="tooltip" style={tooltipStyle}>
            {hoverInfo.kind === 'zone' ? (
              <>
                <strong>{hoverInfo.zone.name}</strong>
                <span>Base price: {hoverInfo.zone.basePriceEurMwh} EUR/MWh</span>
                <span>Net balance: {hoverInfo.zone.netBalanceMw} MW</span>
              </>
            ) : (
              <>
                <strong>
                  {hoverInfo.line.flowMw >= 0 ? hoverInfo.line.from : hoverInfo.line.to} to{' '}
                  {hoverInfo.line.flowMw >= 0 ? hoverInfo.line.to : hoverInfo.line.from}
                </strong>
                <span>Flow: {Math.abs(hoverInfo.line.flowMw)} MW</span>
                <span>Capacity: {hoverInfo.line.capacityMw} MW</span>
                <span>Utilization: {(hoverInfo.line.utilization * 100).toFixed(0)}%</span>
              </>
            )}
          </aside>
        )}
      </section>

      <aside class="panel">
        <h2>Selected zone</h2>
        <div class="zone-picker" role="radiogroup" aria-label="Select bidding zone">
          {['SE1', 'SE2', 'SE3', 'SE4'].map((id) => (
            <button
              type="button"
              key={id}
              class={selectedZone === id ? 'active' : ''}
              onClick={() => setSelectedZone(id)}
            >
              {id}
            </button>
          ))}
        </div>

        <dl class="stats">
          <div>
            <dt>Price level</dt>
            <dd>{selectedZoneStats.zone?.basePriceEurMwh ?? 'n/a'} EUR/MWh</dd>
          </div>
          <div>
            <dt>Local net balance</dt>
            <dd>{selectedZoneStats.zone?.netBalanceMw ?? 'n/a'} MW</dd>
          </div>
          <div>
            <dt>Connected lines</dt>
            <dd>{selectedZoneStats.connectedCount}</dd>
          </div>
          <div>
            <dt>Interconnector net import</dt>
            <dd>{selectedZoneStats.netInterconnectorMw.toFixed(0)} MW</dd>
          </div>
          <div>
            <dt>Highest utilization</dt>
            <dd>{(selectedZoneStats.highestUtilization * 100).toFixed(0)}%</dd>
          </div>
        </dl>

        <section class="legend">
          <h3>Flow utilization</h3>
          <p>
            Arc width follows MW flow. Color follows usage ratio against line capacity.
          </p>
          <ul>
            <li>
              <span class="chip low" />
              <span>Below 70%</span>
            </li>
            <li>
              <span class="chip medium" />
              <span>70% to 89%</span>
            </li>
            <li>
              <span class="chip high" />
              <span>90% and above</span>
            </li>
          </ul>
        </section>

        <p class="disclaimer">Prototype geometry for UX and data-flow testing. Replace with official bidding-zone boundaries in production.</p>
      </aside>
    </main>
  )
}
