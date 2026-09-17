export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  legs?: RouteLeg[];
}

export interface MatrixResult {
  origins: GeoCoordinate[];
  destinations: GeoCoordinate[];
  distancesMeters: number[][];
  durationsSeconds: number[][];
}

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface RoutingProvider {
  geocode(address: string): Promise<GeocodeResult | null>;
  calculateRoute(origin: GeoCoordinate, destination: GeoCoordinate): Promise<RouteResult>;
  calculateMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult>;
}
