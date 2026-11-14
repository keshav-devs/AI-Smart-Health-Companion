import apiClient from "@/api/client";

export type TimelineCategory = "report" | "document" | "medicine" | "dose" | "journal";

export interface TimelineEvent {
  id: string;
  category: TimelineCategory;
  title: string;
  summary: string;
  occurred_at: string;
}

export async function fetchHealthTimeline(limit = 50): Promise<TimelineEvent[]> {
  const response = await apiClient.get<TimelineEvent[]>("/timeline", { params: { limit } });
  return response.data;
}
