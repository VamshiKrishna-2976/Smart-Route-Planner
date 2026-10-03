# SmartRoute

SmartRoute is a responsive public-transit route planner for Hyderabad, built with React, Vite, TypeScript, Tailwind CSS, React Router, Leaflet, Express, and SQLite.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:3001`. The Vite development server proxies `/api` requests to Express. On first startup, the API creates `server/smartroute.db` and seeds the Hyderabad stops, transit connections, and sample service alerts.

```bash
npm run build
npm start
```

The backend uses SQLite compiled to WebAssembly, so a local C++ toolchain is not required. Set `DATABASE_PATH` to store the SQLite database at a different path and `PORT` to change the API port.

Copy `.env.example` to `.env` to configure the backend. `OPENAI_API_KEY` is optional and is used only for the route explanation feature; without it, SmartRoute returns a deterministic explanation. The route engine always calculates routes locally from the transit dataset. Never put provider keys in frontend environment variables.

## App routes

| Path | Page |
| --- | --- |
| `/` | Journey planner |
| `/routes` | Route results |
| `/journey/:id` | Journey details |
| `/saved` | Saved journeys |
| `/status` | Live transit status |
| `/admin` | Transit operations dashboard |

The route finder and service status currently use local demonstration data. Route searches score deterministic alternatives using travel time, fare, transfers, and reported delays. Service changes are stored in SQLite and immediately affect route results.

## API

- `GET /api/health`
- `GET /api/stops`
- `GET /api/services`
- `GET /api/routes/search?from=...&to=...&preference=fastest`
- `GET /api/routes/:id`
- `POST /api/routes/:id/explanation` — explains supplied route facts; never calculates routes
- `GET /api/saved`
- `POST /api/saved`
- `DELETE /api/saved/:id`
- `GET /api/status`
- `GET /api/notifications`
- `POST /api/notifications`
- `GET /api/admin/summary`
- `PATCH /api/admin/services/:id` — set a service status or demo preset (`normal`, `delay10`, `delay15`, `delay20`, `suspended`)

For a quick disruption demo, search a journey that uses Metro · Blue Line, open `/admin`, choose a demo state for that service, and apply it. The route planner refreshes live conditions and offers an unaffected alternative when one is available. Saved journeys and service changes persist in `server/smartroute.db`.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite client and Express API |
| `npm run build` | Type-check and create a production frontend build |
| `npm start` | Start the Express API |
| `npm run preview` | Preview the production frontend build |
