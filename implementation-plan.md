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

- **Production/consumption:** SCB `TAB78` via PxWeb API v2 (monthly).
- **Prices:** ENTSO-E day-ahead zonal prices (`SE1`-`SE4`) via Transparency API once token is enabled.
- **Bottleneck inputs:** Start with configurable synthetic transfer capacities per interconnector, then replace with measured flow/capacity data when a stable public source is confirmed.

## Licensing and usage constraints (Phase 1 outcome)

### SCB PxWeb API
- **License baseline:** SCB open data is published under CC0 according to SCB open-data terms.
- **Practical constraints:** API rate and extraction limits apply; PxWeb v2 documents 30 calls per 10 seconds and up to 150,000 data cells per request.
- **References:**
  - `https://scb.se/om-scb/om-scb.se-och-anvandningsvillkor/oppna-data-api`
  - `https://www.scb.se/en/services/open-data-api/pxwebapi/`

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

The app will normalize all inputs into one schema:

```ts
type Zone = "SE1" | "SE2" | "SE3" | "SE4";

type DataPoint = {
  timestamp: string;           // ISO-8601 start timestamp in UTC
  resolution: "PT60M" | "P1M"; // hourly or monthly
  zone: Zone;
  metric:
    | "price_day_ahead_eur_mwh"
    | "production_total_gwh"
    | "consumption_total_gwh";
  value: number;
  unit: "EUR/MWh" | "GWh";
  source: "ENTSOE" | "SCB";
  sourceSeriesId: string;      // e.g. ENTSOE document+domain key or SCB table code
  quality: "measured" | "estimated" | "model_based";
};
```

### Mapping rules
- `SCB TAB78 / Produktion` -> `production_total_gwh`, `resolution: "P1M"`, `quality: "measured"`.
- `SCB TAB78 / Användning` -> `consumption_total_gwh`, `resolution: "P1M"`, `quality: "model_based"`.
- `ENTSO-E day-ahead price by bidding zone` -> `price_day_ahead_eur_mwh`, `resolution: "PT60M"` (or platform resolution if changed), `quality: "measured"`.
- Store all times in UTC internally; convert to local display timezone in UI.

## Phase 2 - Lightweight app architecture (planned)
- [x] Stack: `Vite + Preact + TypeScript`.
- [ ] Charts: `uPlot` for time series.
- [x] Data ingestion module with source adapters and quality flags (initial version).
- [ ] Optional tiny backend proxy only if needed for CORS/rate limits.

## Phase 3 - Simulation MVP (planned)
- [ ] Four-zone model (`SE1`, `SE2`, `SE3`, `SE4`) with configurable transfer capacities.
- [ ] Simulate constrained transfer and show resulting zonal spreads.
- [ ] Compare baseline data vs bottleneck scenario.

## Next update target

Phase 2 next steps:
1) replace the table preview with chart rendering (`uPlot`),
2) split adapters into dedicated modules and add parsing tests,
3) add first bottleneck simulation controls (capacity slider + scenario compare).

## Pre-Phase 2 fetch verification

Verification run completed before starting Phase 2:

- **SCB (`TAB78`)**: fetch works.
  - `https://statistikdatabasen.scb.se/api/v2/tables/TAB78/metadata?lang=en` -> success
  - `https://statistikdatabasen.scb.se/api/v2/tables/TAB78/data?lang=en&outputFormat=json-stat2` -> success with data payload
- **ENTSO-E day-ahead API**: fetch requires authorization.
  - `https://web-api.tp.entsoe.eu/api?...` (without token) -> `401 Unauthorized`

Decision gate before Phase 2 implementation:
- Proceed with SCB adapter immediately.
- Add ENTSO-E adapter skeleton behind token configuration (`ENTSOE_API_TOKEN`), and activate real fetching once token is available.
