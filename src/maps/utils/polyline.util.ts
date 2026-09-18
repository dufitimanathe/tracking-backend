import { GeoCoordinate } from '../interfaces/routing-provider.interface';

/** Decode Google encoded polyline → lat/lng points. */
export function decodePolyline(encoded: string): GeoCoordinate[] {
  const coordinates: GeoCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance in meters. */
export function distanceMeters(a: GeoCoordinate, b: GeoCoordinate): number {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function distanceToSegmentMeters(
  point: GeoCoordinate,
  start: GeoCoordinate,
  end: GeoCoordinate,
): number {
  if (start.lat === end.lat && start.lng === end.lng) {
    return distanceMeters(point, start);
  }

  const x = point.lng;
  const y = point.lat;
  const x1 = start.lng;
  const y1 = start.lat;
  const x2 = end.lng;
  const y2 = end.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));

  return distanceMeters(point, { lat: y1 + t * dy, lng: x1 + t * dx });
}

/** Minimum distance from a point to an encoded route polyline (meters). */
export function distanceToPolylineMeters(
  point: GeoCoordinate,
  encodedPolyline: string,
): number {
  const path = decodePolyline(encodedPolyline);
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (path.length === 1) {
    return distanceMeters(point, path[0]);
  }

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i += 1) {
    min = Math.min(min, distanceToSegmentMeters(point, path[i], path[i + 1]));
  }
  return min;
}

/**
 * Used later by mobile: "time has reached but you aren't on the specified road".
 * Returns whether the rider is farther than thresholdMeters from the planned route.
 */
export function isOffRoute(
  point: GeoCoordinate,
  encodedPolyline: string,
  thresholdMeters: number,
): { offRoute: boolean; distanceMeters: number; thresholdMeters: number } {
  const distance = distanceToPolylineMeters(point, encodedPolyline);
  return {
    offRoute: distance > thresholdMeters,
    distanceMeters: Math.round(distance),
    thresholdMeters,
  };
}
