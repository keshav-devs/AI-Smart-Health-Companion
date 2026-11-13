/**
 * Report schemas and interfaces.
 */

export type ReportStatus =
  | "not_analyzed"
  | "processing"
  | "needs_review"
  | "analyzed"
  | "manually_entered"
  | "failed";

export type TestValueStatus = "normal" | "high" | "low" | "unspecified";

export interface LabTestItem {
  test_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  status: TestValueStatus;
  needs_review: boolean;
  review_reason?: string | null;
}

export interface ReportExtractionResult {
  patient_name_detected?: string | null;
  report_date_detected?: string | null;
  lab_name_detected?: string | null;
  summary_notes?: string | null;
  tests: LabTestItem[];
  disclaimer: string;
  provenance?: "ai" | "manual";
}

export interface ConfirmExtractionRequest {
  tests: LabTestItem[];
  patient_name_detected?: string | null;
  report_date_detected?: string | null;
  lab_name_detected?: string | null;
  notes?: string | null;
}

export interface Report {
  id: string;
  user_id: string;
  filename: string;
  report_type: string | null;
  mime_type: string;
  file_size: number;
  status: ReportStatus | string;
  extracted_data?: ReportExtractionResult | null;
  explanation_data?: import("@/schemas/explanation").ReportExplanationResult | null;
  extraction_error?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportListResponse {
  reports: Report[];
  total: number;
}

export const STANDARD_MEDICAL_DISCLAIMER =
  "This extraction was performed by AI from your uploaded lab report for personal reference only. " +
  "It is not a medical diagnosis or clinical advice. Do not change, adjust, or discontinue any " +
  "medications or treatments without consulting your healthcare provider.";

export const MAX_REPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB = 10,485,760 bytes
export const MAX_REPORT_FILE_SIZE_LABEL = "10 MB (10,485,760 bytes)";
export const ALLOWED_REPORT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;
export const ALLOWED_REPORT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const ALLOWED_REPORT_FORMATS_LABEL = "PDF, JPG, JPEG, PNG";

export const COMMON_REPORT_TYPES = [
  "Complete Blood Count (CBC)",
  "Comprehensive Metabolic Panel (CMP)",
  "Basic Metabolic Panel (BMP)",
  "Lipid Panel (Cholesterol)",
  "Thyroid Panel (TSH, Free T4)",
  "Hemoglobin A1c (HbA1c)",
  "Liver Function Panel (LFT)",
  "Vitamin D & B12 Panel",
  "General Blood Work",
  "Other Blood Test",
] as const;

export type CommonReportType = (typeof COMMON_REPORT_TYPES)[number];
