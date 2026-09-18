# Google Maps Platform setup (FleetOps)

Leave keys empty until you paste them from **your** Google Cloud Console project.
This repo never ships real keys.

---

## Why you need Maps

| Use | API | Where |
|-----|-----|--------|
| Live fleet map tiles / markers | **Maps JavaScript API** | Frontend (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) |
| Address → lat/lng | **Geocoding API** | Backend (`GOOGLE_MAPS_API_KEY`) |
| Road distance, ETA, polyline for trips | **Routes API** | Backend (`GOOGLE_MAPS_API_KEY`) |
| Optional bulk nearest ranking | **Distance Matrix API** (or Routes matrix later) | Backend |
| Later mobile: “not on specified road” | Routes polyline + `POST /maps/route-deviation` | Backend + mobile |

GPS pings themselves do **not** call Google. Only trip planning, ETA, map UI, and off-route checks do.

---

## Google Cloud Console checklist

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select **your** project (free trial is fine).
2. Enable billing on the project (required even with free credit).
3. **APIs & Services → Library** — enable:
   - Maps JavaScript API
   - Geocoding API
   - Routes API
   - (Optional) Distance Matrix API
   - (Optional) Directions API — used as backend fallback if Routes fails
   - (Later mobile) Places API — address autocomplete
4. **APIs & Services → Credentials → Create credentials → API key** — create **two** keys:

### Key A — Server (backend)

- Name: `fleetops-server`
- Application restriction: **IP addresses** (your VPS / office IP). Locally you can leave unrestricted while developing.
- API restriction: Geocoding, Routes, Distance Matrix, Directions
- Paste into `backend/.env`:

```env
GOOGLE_MAPS_API_KEY=PASTE_SERVER_KEY_HERE
```

### Key B — Browser (web admin / supervisor)

- Name: `fleetops-browser`
- Application restriction: **HTTP referrers**
  - `http://localhost:3001/*`
  - `https://YOUR_PRODUCTION_DOMAIN/*`
- API restriction: **Maps JavaScript API** only
- Paste into `frontend/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=PASTE_BROWSER_KEY_HERE
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000/realtime
```

Never put the server key in the frontend. Never commit either key.

5. Restart backend (`npm run dev`) and frontend after pasting keys.
6. Verify: `GET http://localhost:3000/api/v1/maps/status` → `googleConfigured: true`.

---

## Phone-first tracking (no hardware GPS)

Primary location path:

```text
Rider phone → POST /api/v1/locations/rider → motorcycle_current_locations
           → Socket.IO fleet.location.updated → admin/supervisor maps
```

Requirements for the future **rider mobile app**:

- Background / foreground location (Android + iOS permission flows)
- JWT auth
- Active motorcycle assignment before pings are accepted
- Ping interval ~5–15s while on trip; slower when idle
- Accuracy + `recordedAt` on every ping
- Offline queue when network drops
- Later: compare live point to trip polyline via `POST /maps/route-deviation`
- Later: push notifications when ETA grace exceeded and rider is off-route

Hardware GPS (`POST /integrations/gps/:provider/webhook`) stays optional.

Env:

```env
TRACKING_MODE=phone_primary
TRACKING_ROUTE_DEVIATION_METERS=120
TRACKING_ETA_GRACE_SECONDS=180
```

---

## Backend endpoints ready now

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/maps/status` | Public — is Google configured? (no secrets) |
| POST | `/api/v1/maps/geocode` | Address → coordinates |
| POST | `/api/v1/maps/route` | Origin/destination → distance, ETA, polyline |
| POST | `/api/v1/maps/matrix` | Multi origin/destination matrix |
| POST | `/api/v1/maps/route-deviation` | Point vs polyline (mobile “off road” later) |
| POST | `/api/v1/locations/rider` | Phone GPS ingest |
| GET | `/api/v1/companies/:id/fleet/live` | Live fleet snapshot |
| WS | `/realtime` event `fleet.location.updated` | Live map push |

Without `GOOGLE_MAPS_API_KEY`, routing falls back to Haversine (straight-line). Maps UI without browser key uses the CSS placeholder map.

---

## Cost tips (free trial)

- Do **not** call Google on every GPS ping
- Call Routes only when creating/refreshing a trip estimate
- Cache geocode results for repeated addresses
- Cap Distance Matrix to top-N shortlisted riders after PostGIS
- Set daily quotas / budgets in Google Cloud

---

## Docs

- Routes: https://developers.google.com/maps/documentation/routes
- Geocoding: https://developers.google.com/maps/documentation/geocoding
- Maps JS: https://developers.google.com/maps/documentation/javascript
