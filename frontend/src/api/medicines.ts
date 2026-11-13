/**
 * Medicines API service — CRUD, dose tracking, adherence, and reminder status.
 */

import apiClient from "@/api/client";
import type {
  AdherenceSummary,
  DoseLogPayload,
  DoseLogResponse,
  Medicine,
  MedicineAlertsResponse,
  MedicineCreatePayload,
  MedicineListResponse,
  ReminderProviderStatusResponse,
  TodayDosesResponse,
} from "@/schemas/medicine";

export async function fetchMedicines(activeOnly = false): Promise<MedicineListResponse> {
  const response = await apiClient.get<MedicineListResponse>("/medicines", {
    params: { active_only: activeOnly },
  });
  return response.data;
}

export async function fetchMedicine(medicineId: string): Promise<Medicine> {
  const response = await apiClient.get<Medicine>(`/medicines/${medicineId}`);
  return response.data;
}

export async function createMedicine(data: MedicineCreatePayload): Promise<Medicine> {
  const response = await apiClient.post<Medicine>("/medicines", data);
  return response.data;
}

export async function updateMedicine(
  medicineId: string,
  data: Partial<MedicineCreatePayload>,
): Promise<Medicine> {
  const response = await apiClient.put<Medicine>(`/medicines/${medicineId}`, data);
  return response.data;
}

export async function deleteMedicine(medicineId: string): Promise<void> {
  await apiClient.delete(`/medicines/${medicineId}`);
}

export async function fetchTodayDoses(timezone?: string): Promise<TodayDosesResponse> {
  const clientTz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const response = await apiClient.get<TodayDosesResponse>("/medicines/doses/today", {
    params: { timezone: clientTz },
  });
  return response.data;
}

export async function logDose(
  medicineId: string,
  payload: DoseLogPayload,
): Promise<DoseLogResponse> {
  const response = await apiClient.post<DoseLogResponse>(
    `/medicines/${medicineId}/doses`,
    payload,
  );
  return response.data;
}

export async function fetchAdherenceHistory(days = 30): Promise<AdherenceSummary> {
  const response = await apiClient.get<AdherenceSummary>("/medicines/doses/history", {
    params: { days },
  });
  return response.data;
}

export async function fetchMedicineAlerts(): Promise<MedicineAlertsResponse> {
  const response = await apiClient.get<MedicineAlertsResponse>("/medicines/alerts");
  return response.data;
}

export async function fetchReminderStatus(): Promise<ReminderProviderStatusResponse> {
  const response = await apiClient.get<ReminderProviderStatusResponse>("/medicines/reminders/status");
  return response.data;
}
