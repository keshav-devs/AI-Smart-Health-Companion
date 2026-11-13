import apiClient from './client';

export interface ContactBase {
  contact_type: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  contact_relationship?: string;
  specialty?: string;
  notes?: string;
}

export interface ContactCreate extends ContactBase {
  profile_id: string;
}

export interface ContactUpdate extends ContactBase {}

export interface ContactResponse extends ContactBase {
  id: string;
  created_at: string;
}

export const contactsApi = {
  createContact: async (data: ContactCreate): Promise<ContactResponse> => {
    const res = await apiClient.post<ContactResponse>('/contacts', data);
    return res.data;
  },
  
  getContacts: async (profileId: string): Promise<ContactResponse[]> => {
    const res = await apiClient.get<ContactResponse[]>('/contacts', {
      params: { profile_id: profileId },
    });
    return res.data;
  },

  updateContact: async (id: string, data: ContactUpdate): Promise<ContactResponse> => {
    const res = await apiClient.put<ContactResponse>(`/contacts/${id}`, data);
    return res.data;
  },

  deleteContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/contacts/${id}`);
  }
};
