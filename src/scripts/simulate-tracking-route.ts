/**
 * Dev tool: simulate a rider moving along a polyline and uploading GPS batches.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/simulate-tracking-route.ts \
 *     --token <JWT> --session <SESSION_ID>
 *
 * Or set TRACKING_SIM_TOKEN and TRACKING_SIM_SESSION env vars.
 *
 * Does not log coordinates in production logs — this is a local/dev script only.
 */
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'crypto';

loadEnv();

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/${process.env.API_PREFIX ?? 'api/v1'}`;
const token = process.env.TRACKING_SIM_TOKEN ?? process.argv.find((a, i) => process.argv[i - 1] === '--token');
const sessionId =
  process.env.TRACKING_SIM_SESSION ??
  process.argv.find((a, i) => process.argv[i - 1] === '--session');

if (!token || !sessionId) {
  console.error('Required: --token <JWT> --session <SESSION_ID>');
  process.exit(1);
}

/** Rough Kigali path (≈ few km). */
const ROUTE: Array<{ lat: number; lng: number }> = [
  { lat: -1.9441, lng: 30.0619 },
  { lat: -1.946, lng: 30.07 },
  { lat: -1.95, lng: 30.08 },
  { lat: -1.955, lng: 30.09 },
  { lat: -1.96, lng: 30.1 },
  { lat: -1.965, lng: 30.11 },
  { lat: -1.97, lng: 30.12 },
];

function interpolate(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  t: number,
) {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

async function main() {
  const points: Array<Record<string, unknown>> = [];
  const start = Date.now() - ROUTE.length * 8_000;

  for (let i = 0; i < ROUTE.length - 1; i++) {
    for (let step = 0; step < 4; step++) {
      const p = interpolate(ROUTE[i], ROUTE[i + 1], step / 4);
      const capturedAt = new Date(start + (i * 4 + step) * 8_000).toISOString();
      points.push({
        clientLocationId: randomUUID(),
        trackingSessionId: sessionId,
        latitude: p.lat,
        longitude: p.lng,
        accuracy: 8 + Math.random() * 4,
        speed: 8 + Math.random() * 4,
        heading: 90,
        altitude: 1500,
        capturedAt,
      });
    }
  }

  console.log(`Uploading ${points.length} simulated points to ${API}…`);

  const response = await fetch(`${API}/tracking/locations/batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locations: points }),
  });

  const body = await response.json();
  if (!response.ok) {
    console.error('Upload failed', response.status, body);
    process.exit(1);
  }

  console.log('Done:', {
    accepted: body?.data?.accepted,
    rejected: body?.data?.rejected,
  });
}

void main();
