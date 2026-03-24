# Understanding bottlenecks in the electricity system

Grasping the concept of bottleneck incomes ("flaskhalsintakter") in the electricity system can be tricky, and visualizations are helpful - hence this tool.

## Goal

Build a lightweight simulation web app that shows how transmission constraints between Swedish bidding zones (`SE1`-`SE4`) can create energy-system bottlenecks and zonal price differences.

## Current direction

- Stack: `Preact` + `Vite` + `TypeScript`.
- Data-first approach with public sources where possible.
- UX inspiration from Svenska kraftnat Kontrollrummet.

## ENTSO-E setup

To enable real day-ahead bidding-zone prices in the app, add an ENTSO-E Transparency API token before running the frontend:

```bash
cd app
echo "VITE_ENTSOE_API_TOKEN=your-token-here" > .env.local
npm run dev
```

The app now labels the selected market date and delivery period in CET/CEST so you can compare the shown price snapshot against official ENTSO-E sources.

The map now also uses ENTSO-E cross-border physical flow data for Sweden's neighboring bidding zones. Transmission capacity is currently scoped out in the UI because the relevant ENTSO-E capacity datasets require additional market-specific interpretation before they can be shown reliably as a single comparable value per arc.

## Planning and progress

Detailed implementation planning and ongoing status now live in:

- `implementation-plan.md`