export type ZoneKind = 'sweden' | 'neighbor'

export type ZoneFeatureProperties = {
  id: string
  name: string
  kind: ZoneKind
  basePriceEurMwh: number
  netBalanceMw: number
}

export type ZoneLabel = {
  id: string
  zoneId: string
  position: [number, number]
  text: string
}

export type Interconnector = {
  id: string
  from: string
  to: string
  fromPosition: [number, number]
  toPosition: [number, number]
  capacityMw: number
  flowByStepMw: [number, number, number, number]
}

export const FLOW_STEPS = ['00:00', '06:00', '12:00', '18:00'] as const

export const ZONES_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon, ZoneFeatureProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'SE1', name: 'SE1', kind: 'sweden', basePriceEurMwh: 44, netBalanceMw: 620 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[15.2, 69.8], [22.8, 69.8], [24.0, 65.0], [17.4, 63.8], [13.8, 66.2], [15.2, 69.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'SE2', name: 'SE2', kind: 'sweden', basePriceEurMwh: 49, netBalanceMw: 420 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[13.3, 63.8], [17.4, 63.8], [24.0, 65.0], [22.8, 60.8], [17.7, 59.6], [14.0, 60.2], [13.3, 63.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'SE3', name: 'SE3', kind: 'sweden', basePriceEurMwh: 63, netBalanceMw: -210 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[12.4, 59.6], [17.7, 59.6], [19.3, 58.0], [18.8, 56.1], [14.8, 55.1], [12.1, 56.7], [12.4, 59.6]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'SE4', name: 'SE4', kind: 'sweden', basePriceEurMwh: 71, netBalanceMw: -340 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[12.1, 56.7], [14.8, 55.1], [18.8, 56.1], [16.8, 54.6], [13.1, 54.8], [12.1, 56.7]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'NO3', name: 'NO3', kind: 'neighbor', basePriceEurMwh: 47, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[7.6, 64.0], [13.3, 63.8], [14.0, 60.2], [10.2, 60.0], [7.5, 61.4], [7.6, 64.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'NO1', name: 'NO1', kind: 'neighbor', basePriceEurMwh: 55, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[7.2, 60.0], [10.2, 60.0], [12.1, 56.7], [9.6, 58.1], [7.5, 58.8], [7.2, 60.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'FI', name: 'FI', kind: 'neighbor', basePriceEurMwh: 66, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[22.8, 60.8], [24.0, 65.0], [30.8, 66.8], [30.2, 61.4], [26.6, 59.5], [22.8, 60.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'DK1', name: 'DK1', kind: 'neighbor', basePriceEurMwh: 64, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.0, 57.8], [10.1, 57.8], [10.8, 56.0], [9.4, 55.5], [8.0, 56.6], [8.0, 57.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'DK2', name: 'DK2', kind: 'neighbor', basePriceEurMwh: 69, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.1, 57.8], [13.1, 54.8], [12.1, 54.4], [10.2, 55.0], [10.1, 57.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'EE', name: 'EE', kind: 'neighbor', basePriceEurMwh: 59, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[23.6, 59.8], [28.2, 59.4], [28.0, 57.8], [24.2, 57.6], [23.6, 59.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'LT', name: 'LT', kind: 'neighbor', basePriceEurMwh: 61, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[21.2, 56.3], [26.2, 56.2], [26.0, 54.6], [22.0, 54.4], [21.2, 56.3]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'PL', name: 'PL', kind: 'neighbor', basePriceEurMwh: 73, netBalanceMw: 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[15.0, 54.8], [22.0, 54.4], [23.0, 52.0], [17.2, 51.5], [14.8, 53.4], [15.0, 54.8]]],
      },
    },
  ],
}

export const ZONE_LABELS: ZoneLabel[] = [
  { id: 'SE1-label', zoneId: 'SE1', position: [19.1, 67.1], text: 'SE1' },
  { id: 'SE2-label', zoneId: 'SE2', position: [18.5, 61.8], text: 'SE2' },
  { id: 'SE3-label', zoneId: 'SE3', position: [16.1, 57.7], text: 'SE3' },
  { id: 'SE4-label', zoneId: 'SE4', position: [14.8, 55.2], text: 'SE4' },
  { id: 'NO3-label', zoneId: 'NO3', position: [10.1, 62.4], text: 'NO3' },
  { id: 'NO1-label', zoneId: 'NO1', position: [9.0, 59.0], text: 'NO1' },
  { id: 'FI-label', zoneId: 'FI', position: [27.1, 62.5], text: 'FI' },
  { id: 'DK1-label', zoneId: 'DK1', position: [9.2, 56.8], text: 'DK1' },
  { id: 'DK2-label', zoneId: 'DK2', position: [11.4, 55.8], text: 'DK2' },
  { id: 'EE-label', zoneId: 'EE', position: [25.9, 58.6], text: 'EE' },
  { id: 'LT-label', zoneId: 'LT', position: [23.8, 55.4], text: 'LT' },
  { id: 'PL-label', zoneId: 'PL', position: [18.9, 53.0], text: 'PL' },
]

export const INTERCONNECTORS: Interconnector[] = [
  {
    id: 'SE1-SE2',
    from: 'SE1',
    to: 'SE2',
    fromPosition: [18.9, 66.0],
    toPosition: [18.2, 62.9],
    capacityMw: 3300,
    flowByStepMw: [2100, 2300, 2600, 2200],
  },
  {
    id: 'SE2-SE3',
    from: 'SE2',
    to: 'SE3',
    fromPosition: [17.2, 60.7],
    toPosition: [16.1, 58.6],
    capacityMw: 7300,
    flowByStepMw: [5200, 5700, 6100, 5600],
  },
  {
    id: 'SE3-SE4',
    from: 'SE3',
    to: 'SE4',
    fromPosition: [15.8, 56.9],
    toPosition: [14.6, 55.7],
    capacityMw: 5400,
    flowByStepMw: [3600, 3900, 4100, 3700],
  },
  {
    id: 'NO1-SE3',
    from: 'NO1',
    to: 'SE3',
    fromPosition: [9.8, 58.6],
    toPosition: [13.1, 58.2],
    capacityMw: 2100,
    flowByStepMw: [900, 1200, 1500, 1000],
  },
  {
    id: 'NO3-SE2',
    from: 'NO3',
    to: 'SE2',
    fromPosition: [11.7, 62.0],
    toPosition: [14.4, 61.5],
    capacityMw: 1800,
    flowByStepMw: [600, 700, 1100, 850],
  },
  {
    id: 'SE3-FI',
    from: 'SE3',
    to: 'FI',
    fromPosition: [19.8, 59.9],
    toPosition: [23.2, 60.4],
    capacityMw: 1200,
    flowByStepMw: [-400, -350, 180, 260],
  },
  {
    id: 'SE4-DK2',
    from: 'SE4',
    to: 'DK2',
    fromPosition: [13.4, 55.1],
    toPosition: [11.8, 55.4],
    capacityMw: 1700,
    flowByStepMw: [800, 900, 1200, 950],
  },
  {
    id: 'SE4-PL',
    from: 'SE4',
    to: 'PL',
    fromPosition: [15.0, 54.8],
    toPosition: [16.8, 53.9],
    capacityMw: 650,
    flowByStepMw: [540, 590, 620, 600],
  },
  {
    id: 'SE4-LT',
    from: 'SE4',
    to: 'LT',
    fromPosition: [17.2, 55.0],
    toPosition: [21.5, 55.5],
    capacityMw: 700,
    flowByStepMw: [300, 340, 410, 360],
  },
  {
    id: 'SE4-EE',
    from: 'SE4',
    to: 'EE',
    fromPosition: [18.0, 56.2],
    toPosition: [23.6, 58.0],
    capacityMw: 1000,
    flowByStepMw: [380, 450, 560, 420],
  },
]
