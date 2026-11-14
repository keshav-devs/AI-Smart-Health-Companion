import apiClient from "./client";

export interface EmergencyContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface EmergencyMedicineItem {
  id: string;
  name: string;
  strength?: string | null;
  form?: string | null;
  instructions?: string | null;
}

export interface EmergencyProfileInfo {
  id: string;
  name: string;
  relationship_type: string;
  date_of_birth?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
}

export interface EmergencyInfoResponse {
  profile: EmergencyProfileInfo;
  emergency_contacts: EmergencyContactItem[];
  active_medicines: EmergencyMedicineItem[];
  retrieved_at: string;
  disclaimer: string;
}

export async function fetchEmergencyInfo(profileId?: string): Promise<EmergencyInfoResponse> {
  const { data } = await apiClient.get<EmergencyInfoResponse>("/emergency", {
    params: profileId ? { profile_id: profileId } : {},
  });
  return data;
}

