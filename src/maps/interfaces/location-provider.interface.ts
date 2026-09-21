export interface PlaceCandidate {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

export interface LocationSearchOptions {
  query: string;
  /** Bias results toward this region (ISO country code, default RW). */
  regionCode?: string;
  languageCode?: string;
  maxResults?: number;
}

export interface LocationProvider {
  searchPlaces(options: LocationSearchOptions): Promise<PlaceCandidate[]>;
  getPlaceDetails(placeId: string): Promise<PlaceCandidate | null>;
}
