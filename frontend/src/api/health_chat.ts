import apiClient from "@/api/client";

export interface HealthChatResponse {
  answer: string;
  emergency: boolean;
  disclaimer: string;
}

export async function sendHealthQuestion(message: string): Promise<HealthChatResponse> {
  const response = await apiClient.post<HealthChatResponse>("/chat", { message }, { timeout: 60000 });
  return response.data;
}
