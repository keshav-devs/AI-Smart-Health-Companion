import apiClient from "./client";

export interface DocumentResponse {
  id: string;
  title: string;
  document_type: string;
  notes?: string | null;
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
    notes?: string,
  ): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("document_type", documentType);
    if (notes?.trim()) formData.append("notes", notes.trim());

    const { data } = await apiClient.post<DocumentResponse>("/documents", formData, {
      params: { profile_id: profileId },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  getDocuments: async (profileId: string): Promise<DocumentResponse[]> => {
    const { data } = await apiClient.get<DocumentResponse[]>("/documents", {
      params: { profile_id: profileId },
    });
    return data;
  },

  deleteDocument: async (documentId: string, profileId: string): Promise<void> => {
    await apiClient.delete(`/documents/${documentId}`, { params: { profile_id: profileId } });
  },

  downloadDocument: async (profileId: string, documentId: string, filename: string): Promise<void> => {
    const { data } = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
      params: { profile_id: profileId },
      responseType: "blob",
    });
    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
