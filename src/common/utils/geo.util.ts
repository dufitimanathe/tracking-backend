export interface GeoPoint {
  lng: number;
  lat: number;
}

/** WKT for raw SQL (ST_GeogFromText / ST_GeomFromText). */
export function toPointWkt({ lng, lat }: GeoPoint): string {
  return `POINT(${lng} ${lat})`;
}

/**
 * GeoJSON Point for TypeORM geography columns.
 * TypeORM writes via ST_GeomFromGeoJSON — WKT strings fail with "unknown GeoJSON type".
 */
export function toPointGeoJson({ lng, lat }: GeoPoint): {
  type: 'Point';
  coordinates: [number, number];
} {
  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
}

export function fromPointWkt(wkt: string): GeoPoint | null {
  const match = /^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i.exec(wkt.trim());
  if (!match) {
    return null;
  }

  return {
    lng: Number.parseFloat(match[1]),
    lat: Number.parseFloat(match[2]),
  };
}

export function geographyToPoint(value: string | object): GeoPoint | null {
  if (typeof value === 'string') {
    return fromPointWkt(value);
  }

  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    (value as { type: string }).type === 'Point' &&
    'coordinates' in value
  ) {
    const coordinates = (value as { coordinates: [number, number] }).coordinates;
    return { lng: coordinates[0], lat: coordinates[1] };
  }

  return null;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
