/**
 * Axios API client — configured from the VITE_API_BASE_URL env var.
 *
 * Automatically attaches the JWT token from localStorage and maps
 * error responses into user-friendly messages.
 */

import axios, { type AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Request interceptor — attach JWT ─────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Inject active profile_id into supported routes if not already provided
  const url = config.url || "";
  if (["/reports", "/medicines", "/journal", "/documents", "/contacts", "/doctor-questions", "/timeline"].some((route) => url.startsWith(route))) {
    const profileId = localStorage.getItem("current_profile_id");
    if (profileId && !config.params?.profile_id) {
      config.params = { ...config.params, profile_id: profileId };
    }
  }

  return config;
});

// ── Response interceptor — normalise errors ──────────────────────────

export interface ApiError {
  detail: string;
  status: number;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: any }>) => {
    const status = error.response?.status ?? 500;
    const rawDetail = error.response?.data?.detail;
    let detail = "Something went wrong. Please try again.";

    if (typeof rawDetail === "string") {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      detail = rawDetail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && item.msg) {
            const loc = Array.isArray(item.loc)
              ? item.loc.filter((l: string) => l !== "body").join(".")
              : "";
            return loc ? `${loc}: ${item.msg}` : item.msg;
          }
          return JSON.stringify(item);
        })
        .join("; ");
    } else if (rawDetail && typeof rawDetail === "object") {
      detail = (rawDetail as any).message || (rawDetail as any).msg || JSON.stringify(rawDetail);
    } else if (error.message) {
      detail = error.message;
    }

    // Auto-logout on 401
    if (status === 401) {
      localStorage.removeItem("access_token");
    }

    return Promise.reject({ detail, status } satisfies ApiError);
  },
);

export default apiClient;
