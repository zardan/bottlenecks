import type { EntsoeCrossBorderFlowPoint, EntsoePricePoint, SwedishZone } from './entsoe'
import type { ZoneFeatureProperties } from './grid-data'

export type FlowArc = {
  id: string
  from: string
  to: string
  fromPosition: [number, number]
  toPosition: [number, number]
  flowMw: number
  deliveryPeriodCet: string
  marketDateCet: string
}

export type HoverInfo =
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
      line: FlowArc
    }
  | null

export type PriceState =
  | {
      status: 'loading'
      fetchedAt: null
      seriesByZone: null
      error: null
    }
  | {
      status: 'ready'
      fetchedAt: string
      seriesByZone: Record<SwedishZone, EntsoePricePoint[]>
      error: null
    }
  | {
      status: 'error'
      fetchedAt: null
      seriesByZone: null
      error: string
    }

export type FlowState =
  | {
      status: 'loading'
      fetchedAt: null
      seriesByLink: null
      error: null
    }
  | {
      status: 'ready'
      fetchedAt: string
      seriesByLink: Record<string, EntsoeCrossBorderFlowPoint[]>
      error: null
    }
  | {
      status: 'error'
      fetchedAt: null
      seriesByLink: null
      error: string
    }
