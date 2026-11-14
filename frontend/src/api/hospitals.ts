import apiClient from "./client";

export type FacilityType = "all" | "hospital" | "clinic" | "pharmacy" | "blood_bank";

export interface FacilityItem {
  id: string;
  name: string;
  facility_type: "hospital" | "clinic" | "pharmacy" | "blood_bank" | "other";
  address?: string | null;
  distance_meters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  source: string;
  attribution: string;
}

export interface NearbyFacilitiesResponse {
  facilities: FacilityItem[];
  count: number;
  search_center: { latitude: number; longitude: number };
  search_radius_meters: number;
  retrieval_time: string;
  source_attribution: string[];
  status: "ok" | "no_results" | "provider_unavailable";
  notes?: string | null;
}

export interface SearchNearbyParams {
  lat: number;
  lon: number;
  radius?: number;
  facility_type?: FacilityType;
}

export async function fetchNearbyFacilities(
  params: SearchNearbyParams
): Promise<NearbyFacilitiesResponse> {
  const { data } = await apiClient.get<NearbyFacilitiesResponse>("/hospitals", {
    params,
  });
  return data;
}

