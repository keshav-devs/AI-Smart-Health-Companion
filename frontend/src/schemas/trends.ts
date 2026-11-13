/**
 * Types for Report Trends and History Comparison.
 */

export interface TestDataPoint {
  report_id: string;
  report_filename: string;
  report_date: string | null;
  created_at: string;
  raw_value: string;
  numeric_value: number | null;
  unit: string | null;
  reference_range: string | null;
  status: string;
}

export interface TestComparisonPoint {
  current: TestDataPoint;
  previous: TestDataPoint | null;
  is_comparable: boolean;
  non_comparable_reason: string | null;
  difference: number | null;
  percent_change: number | null;
  direction: "higher" | "lower" | "unchanged" | "not_comparable";
}

export interface TestTrendSummary {
  test_name: string;
  canonical_unit: string | null;
  data_points: TestDataPoint[];
  comparisons: TestComparisonPoint[];
  latest_status: string;
  has_incomparable_points: boolean;
  incomparable_reasons: string[];
}

export interface ReportTrendsResponse {
  tests: TestTrendSummary[];
  total_confirmed_reports: number;
  tracked_tests_count: number;
  disclaimer: string;
}
