import apiClient from './client';

export interface JournalEntryBase {
  date: string;
  mood?: string;
  sleep_hours?: number;
  symptoms?: string[];
  notes?: string;
}

export interface JournalEntryCreate extends JournalEntryBase {
  profile_id: string;
}

export type JournalEntryUpdate = Partial<JournalEntryBase>;

export interface JournalEntryResponse extends JournalEntryBase {
  id: string;
  created_at: string;
}

export const journalApi = {
  createEntry: async (data: JournalEntryCreate): Promise<JournalEntryResponse> => {
    const res = await apiClient.post<JournalEntryResponse>('/journal', data);
    return res.data;
  },
  
  getEntries: async (profileId: string): Promise<JournalEntryResponse[]> => {
    const res = await apiClient.get<JournalEntryResponse[]>('/journal', {
      params: { profile_id: profileId },
    });
    return res.data;
  },

  updateEntry: async (id: string, data: JournalEntryUpdate): Promise<JournalEntryResponse> => {
    const res = await apiClient.put<JournalEntryResponse>(`/journal/${id}`, data);
    return res.data;
  },

  deleteEntry: async (id: string): Promise<void> => {
    await apiClient.delete(`/journal/${id}`);
  }
};
