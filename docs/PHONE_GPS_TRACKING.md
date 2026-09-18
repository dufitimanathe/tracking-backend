# Phone GPS tracking (production)

Phone-first fleet tracking: rider Expo app → Nest tracking API → PostGIS history + Redis live + Socket.IO → admin Live Operations map.

## Architecture

- **Historical truth:** PostgreSQL / PostGIS (`location_pings`, `tracking_sessions`, `driver_stops`, `geofences`)
- **Live state:** Redis keys `tracking:driver:{riderId}`, set `tracking:company:{companyId}:drivers`
- **Realtime:** Socket.IO `/realtime` company rooms; events `tracking.driver-location`, `tracking.driver-status`, …
- **Distance:** PostGIS geography / accepted point segments — **not** Google Directions

## Migrations

```bash
npm run migration:run
```

Migration: `1740000000000-TrackingSessions.ts`

## Rider APIs

| Method | Path |
|--------|------|
| POST | `/tracking/sessions/start` |
| GET | `/tracking/sessions/active` |
| POST | `/tracking/sessions/:id/end` |
| POST | `/tracking/locations` |
| POST | `/tracking/locations/batch` |

Identity comes from JWT. Do not trust client `driverId` / `companyId`.

## Company APIs

| Method | Path |
|--------|------|
| GET | `/companies/:id/tracking/live` |
| GET | `/companies/:id/tracking/statistics` |
| GET | `/companies/:id/tracking/sessions` |
| GET | `/companies/:id/tracking/sessions/:id/route` |
| GET | `/companies/:id/tracking/drivers/:riderId/statistics` |
| CRUD | `/companies/:id/tracking/geofences` |

## Config (see `.env.example`)

Accuracy, movement/stop thresholds, presence LIVE/DELAYED/STALE/OFFLINE windows, Redis TTL, batch size, optional `TRACKING_ROADS_SNAP_ENABLED`.

## Dev simulator

After a rider starts a session:

```bash
npx ts-node -r tsconfig-paths/register src/scripts/simulate-tracking-route.ts \
  --token <JWT> --session <SESSION_ID>
```

Watch `/admin/live` for marker movement without a physical ride.

## Observability

- GPS rejects logged at debug with reason (no coordinates in prod logs by default)
- Presence sweep job `tracking-presence` when `WORKER_MODE=true`
- Metrics to add later: accepted/rejected counters, active sessions gauge

## Privacy

- Track only during explicit Start Tracking sessions
- Company isolation on REST + Socket rooms
- Retention: `TRACKING_HISTORY_RETENTION_DAYS`

## Mobile

See `mobile/README.md` — background GPS requires a **dev/prod build**, not Expo Go. Real-device checklist included there.
