import apiClient from './client';

export interface DoctorQuestionBase {
  question: string;
  answer?: string;
  is_asked?: boolean;
}

export interface DoctorQuestionCreate extends DoctorQuestionBase {
  profile_id: string;
}

export type DoctorQuestionUpdate = Partial<DoctorQuestionBase>;

export interface DoctorQuestionResponse extends DoctorQuestionBase {
  id: string;
  created_at: string;
}

export interface DoctorQuestionSuggestionsResponse {
  suggestions: string[];
  disclaimer: string;
}

export const doctorQuestionsApi = {
  createQuestion: async (data: DoctorQuestionCreate): Promise<DoctorQuestionResponse> => {
    const res = await apiClient.post<DoctorQuestionResponse>('/doctor-questions', data);
    return res.data;
  },
  
  getQuestions: async (profileId: string): Promise<DoctorQuestionResponse[]> => {
    const res = await apiClient.get<DoctorQuestionResponse[]>('/doctor-questions', {
      params: { profile_id: profileId },
    });
    return res.data;
  },

  generateSuggestions: async (profileId: string): Promise<DoctorQuestionSuggestionsResponse> => {
    const res = await apiClient.post<DoctorQuestionSuggestionsResponse>(
      "/doctor-questions/generate",
      null,
      { params: { profile_id: profileId }, timeout: 60000 },
    );
    return res.data;
  },

  updateQuestion: async (id: string, data: DoctorQuestionUpdate): Promise<DoctorQuestionResponse> => {
    const res = await apiClient.put<DoctorQuestionResponse>(`/doctor-questions/${id}`, data);
    return res.data;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await apiClient.delete(`/doctor-questions/${id}`);
  }
};
