# Implementation plan (living)

This plan is updated as work progresses.

## Phase 1 - Data source validation (completed)
- [x] Confirm whether Nord Pool data can be fetched without a paid/developer account.
- [x] Identify at least one open/public source for Swedish bidding-zone production and consumption.
- [x] Identify open/public source options for day-ahead zonal prices.
- [x] Document licensing/terms constraints for each selected source.
- [x] Freeze MVP data contract for app ingestion.

## Phase 1 findings: public/open data matrix

### 1) Nord Pool
- **Status:** Not open for direct unauthenticated API usage.
- **What was tested:**
  - `https://data-api.nordpoolgroup.com/api/v2/Auction/Prices/ByAreas?...` -> `401 Unauthorized`
  - `https://data-api.nordpoolgroup.com/api/v2/PowerSystem/Consumptions/ByAreas?...` -> `401 Unauthorized`
  - `https://data-api.nordpoolgroup.com/api/v2/PowerSystem/Productions/ByAreas?...` -> `401 Unauthorized`
  - Legacy endpoint `https://www.nordpoolgroup.com/api/marketdata/page/29` -> `410 Gone`
- **Conclusion:** Current Nord Pool API requires auth/account; public anonymous API access is not available.

### 2) SCB (Statistics Sweden) PxWeb API v2
- **Status:** Open/public and machine-readable (no login needed for table access).
- **Confirmed endpoints:**
  - API docs: `https://www.scb.se/api_en/`
  - Swagger: `https://statistikdatabasen.scb.se/api/v2/index.html`
  - Relevant table discovery:
    - `https://statistikdatabasen.scb.se/api/v2/tables?lang=en&query=bidding%20zone`
  - Bidding-zone production/consumption table:
    - `https://statistikdatabasen.scb.se/api/v2/tables/TAB78?lang=en`
    - `https://statistikdatabasen.scb.se/api/v2/tables/TAB78/metadata?lang=en`
    - `https://statistikdatabasen.scb.se/api/v2/tables/TAB78/data?lang=en&outputFormat=json-stat2`
- **Data granularity:** Monthly.
- **Coverage:** `SE1`-`SE4`, production categories + usage.
- **Caveat:** Consumption per bidding area is model-based (explicit note in metadata).

### 3) Svenska kraftnat - Kontrollrummet
- **Status:** Strong reference for UX and context; not yet confirmed as an open API source for robust ingestion.
- **Reference page:** `https://www.svk.se/om-kraftsystemet/kontrollrummet/`
- **Important caveat from page text:** Data may be delayed/incomplete and is not guaranteed fully exact/instant.
- **Use in project:** Visual and domain reference, plus links to official statistics sources.

### 4) ENTSO-E Transparency (price source decision)
- **Status:** Selected as the day-ahead zonal price source for MVP.
- **Access model:** Publicly available platform data with registration/token-based API access (not paid partner data).
- **What was tested:**
  - API call without token to `https://web-api.tp.entsoe.eu/api?...` -> `401 Unauthorized`
- **Conclusion:** ENTSO-E is viable for official zonal day-ahead prices, but requires obtaining an API token/authorized access first.
- **References:**
  - `https://www.entsoe.eu/data/transparency-platform/`
  - `https://transparency.entsoe.eu/`
  - `https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html`

## Proposed MVP data baseline (public-first)

- **Prices:** ENTSO-E day-ahead zonal prices (`SE1`-`SE4`) via Transparency API (A44 document type).
- **Cross-border flows:** ENTSO-E physical flows (A11 document type) for all Swedish interconnectors.
- **Bottleneck inputs:** Start with configurable synthetic transfer capacities per interconnector, then replace with measured capacity data (A31/A26) when ready.
- **Production/consumption:** Dropped from MVP scope. SCB `TAB78` was investigated and confirmed working, but monthly granularity was too coarse for the real-time map approach. May revisit later if needed.

## Licensing and usage constraints (Phase 1 outcome)

### ENTSO-E Transparency
- **Data governance:** Official EU-regulated transparency platform; data publication and extraction framework documented by ENTSO-E.
- **Practical constraints:** API access is authorization/token based (unauthorized requests fail with 401).
- **References:**
  - `https://www.entsoe.eu/data/transparency-platform/`
  - `https://www.entsoe.eu/data/entso-e-transparency-platform/Manual-of-Procedures/Pages/default.aspx`
  - `https://transparency.entsoe.eu/content/static_content/Static%20content/terms%20and%20conditions/terms%20and%20conditions.html`

### Nord Pool
- **Status for this project:** Excluded from the no-partner MVP path due to authentication/commercial access model.
- **References:**
  - `https://data-api.nordpoolgroup.com/`
  - `https://www.nordpoolgroup.com/en/services/power-market-data-services/dataportalregistration/`

## MVP data contract (frozen for implementation)

The app consumes ENTSO-E data only:

```ts
type Zone = "SE1" | "SE2" | "SE3" | "SE4";

// Day-ahead prices (A44)
type EntsoePricePoint = {
  zone: Zone;
  deliveryStartUtc: string;
  deliveryEndUtc: string;
  deliveryHourCet: number;
  marketDateCet: string;
  deliveryPeriodCet: string;
  priceEurMwh: number;
  resolution: string;
};

// Physical cross-border flows (A11)
type EntsoeCrossBorderFlowPoint = {
  linkId: string;
  from: string;
  to: string;
  deliveryStartUtc: string;
  deliveryEndUtc: string;
  marketDateCet: string;
  deliveryPeriodCet: string;
  flowMw: number;
  resolution: string;
};
```

### Mapping rules
- `ENTSO-E A44 day-ahead price by bidding zone` -> zonal prices in EUR/MWh per delivery period.
- `ENTSO-E A11 physical cross-border flows` -> net flow in MW per interconnector per delivery period.
- All times stored in UTC internally; converted to CET/CEST for display.

## Phase 2 - Lightweight app architecture (completed)
- [x] Stack: `Vite + Preact + TypeScript`.
- [x] Map visualization: `MapLibre GL JS` + `deck.gl` (GeoJsonLayer, ArcLayer, TextLayer).
- [x] ENTSO-E data ingestion: day-ahead prices (A44) and physical cross-border flows (A11) via proxy.
- [x] Parallel API fetching with `Promise.allSettled` for prices + flows.
- [x] Interactive time slider with arrow buttons and discrete tick marks.
- [x] Bidding zone picker (SE1–SE4) with map highlight sync.
- [x] Cross-border flow verification table.
- [x] Zone price display panel.
- [x] Responsive layout: controls section, status bar, map (2/3) + table (1/3).
- [x] Codebase cleanup: types extracted to `types.ts`, constants hoisted to module scope.
- [ ] Charts: `uPlot` for time series (deferred — map-first approach taken instead).
- [ ] Optional tiny backend proxy only if needed for CORS/rate limits.

## Phase 3 - Simulation MVP (planned)
- [ ] Four-zone model (`SE1`, `SE2`, `SE3`, `SE4`) with configurable transfer capacities.
- [ ] Wire real ENTSO-E capacity data (A31/A26 document types) for utilization coloring.
- [ ] Replace hand-drawn zone polygons with official ENTSO-E/TYNDP bidding-zone boundaries.
- [ ] Simulate constrained transfer and show resulting zonal spreads.
- [ ] Compare baseline data vs bottleneck scenario.
- [ ] Code-split the JS bundle (currently ~1.8 MB, Vite warns about chunk size).

## Current app status (2026-03-24)

### What works
- Real ENTSO-E day-ahead prices for SE1–SE4 fetched and displayed.
- Real ENTSO-E physical cross-border flows for 7 links (NO1↔SE3, NO3↔SE2, SE3↔FI, SE4↔DK2, SE4↔PL, SE4↔LT, SE4↔EE).
- Interactive time slider navigates across all available delivery periods.
- Map highlights the selected bidding zone (light blue fill, blue border).
- Arc layer shows flow direction and magnitude.
- Verification table lists all cross-border flows for the selected period.
- Fetch status badges shown inline (no card wrappers).

### Architecture
- `app/src/app.tsx` — Main App component (map, controls, table, data fetching).
- `app/src/types.ts` — Shared type definitions (FlowArc, HoverInfo, PriceState, FlowState).
- `app/src/entsoe.ts` — ENTSO-E API fetching and XML parsing.
- `app/src/grid-data.ts` — Static zone polygons, labels, and cross-border link definitions.
- `app/src/app.css` — All styling (flex/grid layout, responsive breakpoints).

### Known limitations
- Zone polygons are hand-drawn approximations, not official boundaries.
- Cross-border capacity data not yet wired (arcs show flow magnitude only, not utilization).
- No time-series chart view yet.
- JS bundle is ~1.8 MB (deck.gl + MapLibre are heavy; could benefit from code-splitting).

## Pre-Phase 2 fetch verification

Verification run completed before starting Phase 2:

- **ENTSO-E day-ahead API**: working with token via Vite proxy.
  - Day-ahead prices (A44) for SE1–SE4: fetched successfully.
  - Physical cross-border flows (A11) for 7 links: fetched successfully.
- **SCB (`TAB78`)**: confirmed working but dropped from scope (monthly granularity too coarse for real-time map).
- Add ENTSO-E adapter skeleton behind token configuration (`ENTSOE_API_TOKEN`), and activate real fetching once token is available.
