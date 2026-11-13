/**
 * Reports API service — upload, list, get details, download.
 */

import apiClient from "@/api/client";
import type { Report, ReportListResponse } from "@/schemas/report";

export async function uploadReport(
  file: File,
  reportType?: string,
): Promise<Report> {
  const formData = new FormData();
  formData.append("file", file);
  if (reportType && reportType.trim()) {
    formData.append("report_type", reportType.trim());
  }

  const response = await apiClient.post<Report>("/reports", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export async function fetchReports(): Promise<ReportListResponse> {
  const response = await apiClient.get<ReportListResponse>("/reports");
  return response.data;
}

export async function fetchReportDetails(reportId: string): Promise<Report> {
  const response = await apiClient.get<Report>(`/reports/${reportId}`);
  return response.data;
}

export async function fetchReportBlob(
  reportId: string,
  disposition: "inline" | "attachment" = "inline",
): Promise<{ blob: Blob; mimeType: string }> {
  const response = await apiClient.get(`/reports/${reportId}/file`, {
    params: { disposition },
    responseType: "blob",
  });
  return {
    blob: response.data as Blob,
    mimeType: String(response.headers["content-type"] || "application/octet-stream"),
  };
}

export async function downloadReportFile(reportId: string, filename: string): Promise<void> {
  const { blob } = await fetchReportBlob(reportId, "attachment");
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export function getAuthenticatedReportFileUrl(
  reportId: string,
  disposition: "inline" | "attachment" = "inline",
): string {
  const base = apiClient.defaults.baseURL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const profileId = localStorage.getItem("current_profile_id");
  const params = new URLSearchParams({ disposition });
  if (token) {
    params.set("token", token);
  }
  if (profileId) {
    params.set("profile_id", profileId);
  }
  return `${base}/reports/${reportId}/file?${params.toString()}`;
}

export async function analyzeReport(reportId: string): Promise<Report> {
  const response = await apiClient.post<Report>(`/reports/${reportId}/analyze`);
  return response.data;
}

export async function confirmExtraction(
  reportId: string,
  data: import("@/schemas/report").ConfirmExtractionRequest,
): Promise<Report> {
  const response = await apiClient.post<Report>(`/reports/${reportId}/confirm`, data);
  return response.data;
}

export async function explainReport(
  reportId: string,
): Promise<import("@/schemas/explanation").ReportExplanationResult> {
  const response = await apiClient.post<import("@/schemas/explanation").ReportExplanationResult>(
    `/reports/${reportId}/explain`
  );
  return response.data;
}

export async function getReportExplanation(
  reportId: string,
): Promise<import("@/schemas/explanation").ReportExplanationResult> {
  const response = await apiClient.get<import("@/schemas/explanation").ReportExplanationResult>(
    `/reports/${reportId}/explanation`
  );
  return response.data;
}

export async function askReportQuestion(
  reportId: string,
  question: string,
): Promise<import("@/schemas/explanation").ReportQuestionResponse> {
  const response = await apiClient.post<import("@/schemas/explanation").ReportQuestionResponse>(
    `/reports/${reportId}/questions`,
    { question }
  );
  return response.data;
}

export async function fetchReportTrends(): Promise<import("@/schemas/trends").ReportTrendsResponse> {
  const response = await apiClient.get<import("@/schemas/trends").ReportTrendsResponse>("/reports/trends");
  return response.data;
}

