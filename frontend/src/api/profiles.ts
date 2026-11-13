import apiClient from './client';

export interface Profile {
  id: string;
  name: string;
  relationship_type: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ProfileCreate {
  name: string;
  relationship_type: string;
}

export interface ProfileUpdate {
  name?: string;
  relationship_type?: string;
  is_active?: boolean;
}

export async function listProfiles(activeOnly: boolean = true): Promise<Profile[]> {
  const { data } = await apiClient.get<Profile[]>('/profiles', {
    params: { active_only: activeOnly },
  });
  return data;
}

export async function createProfile(payload: ProfileCreate): Promise<Profile> {
  const { data } = await apiClient.post<Profile>('/profiles', payload);
  return data;
}

export async function updateProfile(id: string, payload: ProfileUpdate): Promise<Profile> {
  const { data } = await apiClient.put<Profile>(`/profiles/${id}`, payload);
  return data;
}
