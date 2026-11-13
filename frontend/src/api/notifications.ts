import apiClient from './client';

export interface NotificationBase {
  title: string;
  message: string;
  is_read?: boolean;
}

export interface NotificationCreate extends NotificationBase {}

export interface NotificationUpdate {
  is_read?: boolean;
}

export interface NotificationResponse extends NotificationBase {
  id: string;
  created_at: string;
}

export const notificationsApi = {
  createNotification: async (data: NotificationCreate): Promise<NotificationResponse> => {
    const res = await apiClient.post<NotificationResponse>('/notifications', data);
    return res.data;
  },
  
  getNotifications: async (): Promise<NotificationResponse[]> => {
    const res = await apiClient.get<NotificationResponse[]>('/notifications');
    return res.data;
  },

  markRead: async (id: string): Promise<NotificationResponse> => {
    const res = await apiClient.put<NotificationResponse>(`/notifications/${id}/read`);
    return res.data;
  },

  deleteNotification: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`);
  }
};
