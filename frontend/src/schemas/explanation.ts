/**
 * Types for Report Explanations and Q&A.
 */

export interface TestExplanationItem {
  test_name: string;
  observed_value: string;
  unit: string | null;
  reference_range: string | null;
  status: "normal" | "high" | "low" | "unspecified";
  explanation: string;
  interpretation: string;
}

export interface ReportExplanationResult {
  summary: string;
  key_findings: string[];
  test_explanations: TestExplanationItem[];
  limitations: string | null;
  report_date: string | null;
  data_points_analyzed: number;
  disclaimer: string;
}

export interface ReportQuestionRequest {
  question: string;
}

export interface ReportQuestionResponse {
  question: string;
  answer: string;
  cited_tests: string[];
  disclaimer: string;
}
