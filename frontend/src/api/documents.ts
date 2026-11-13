import apiClient from './client';

export interface DocumentResponse {
  id: string;
  title: string;
  document_type: string;
  notes?: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export const documentsApi = {
  uploadDocument: async (
    profileId: string,
    file: File,
    title: string,
    documentType: string,
    notes?: string
  ): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('document_type', documentType);
    if (notes) {
      formData.append('notes', notes);
    }
    const { data } = await apiClient.post<DocumentResponse>('/documents', formData, {
      params: { profile_id: profileId },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  
  getDocuments: async (profileId: string): Promise<DocumentResponse[]> => {
    const { data } = await apiClient.get<DocumentResponse[]>('/documents', {
      params: { profile_id: profileId },
    });
    return data;
  },

  getDocumentDownloadUrl: (documentId: string): string => {
    return `/documents/${documentId}/download`;
  },

  getDocumentPreviewUrl: (documentId: string): string => {
    return `/documents/${documentId}/file?disposition=inline`;
  },
};
