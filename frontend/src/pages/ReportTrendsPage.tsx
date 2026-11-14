/**
 * Report trends & history comparison page.
 * Compares recognized tests across confirmed blood reports deterministically.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchReportTrends } from "@/api/reports";
import { STANDARD_MEDICAL_DISCLAIMER } from "@/schemas/report";
import type { TestTrendSummary } from "@/schemas/trends";
import { useProfile } from "@/hooks/useProfile";

export function ReportTrendsPage() {
  const [selectedTest, setSelectedTest] = useState<string>("ALL");
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const {
    data: trendsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["report-trends", profileId],
    queryFn: fetchReportTrends,
    enabled: !!profileId,
  });

  const tests = trendsData?.tests || [];
  const totalConfirmed = trendsData?.total_confirmed_reports || 0;

  const filteredTests =
    selectedTest === "ALL"
      ? tests
      : tests.filter((t) => t.test_name === selectedTest);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link to="/reports" className="hover:text-primary-600 font-medium">
                Reports
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-semibold">Trends & History</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Laboratory Trends & History
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Deterministic chronological comparison across your confirmed blood reports.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/reports">
              <Button variant="secondary" size="sm">
                View All Reports
              </Button>
            </Link>
            <Link to="/reports/upload">
              <Button size="sm">
                Upload New Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading */}
        {isLoading && <LoadingSpinner message="Calculating test history and trends…" />}

        {/* Error */}
        {isError && (
          <ErrorMessage
            message="Failed to load report trends. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {/* Content */}
        {!isLoading && !isError && (
          <>
            {totalConfirmed === 0 || tests.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                }
                title="No confirmed test data yet"
                description="To view trends and compare laboratory results across time, you need at least one confirmed report. Upload a report and click 'Confirm & Save Analyzed Data' after review."
                action={
                  <Link to="/reports">
                    <Button size="sm">View Reports</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-6">
                {/* Stats & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary-50 text-primary-800 font-semibold border border-primary-100">
                      📊 {totalConfirmed} Confirmed Report{totalConfirmed === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 text-gray-800 font-semibold">
                      🧪 {tests.length} Tracked Test{tests.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Filter Dropdown */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="test-filter" className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Filter Test:
                    </label>
                    <select
                      id="test-filter"
                      value={selectedTest}
                      onChange={(e) => setSelectedTest(e.target.value)}
                      className="text-xs rounded-xl border border-gray-300 px-3 py-2 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm"
                    >
                      <option value="ALL">All Tracked Tests ({tests.length})</option>
                      {tests.map((t) => (
                        <option key={t.test_name} value={t.test_name}>
                          {t.test_name} ({t.data_points.length} points)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Test Cards List */}
                <div className="space-y-6">
                  {filteredTests.map((trendSummary) => (
                    <TestTrendCard key={trendSummary.test_name} summary={trendSummary} />
                  ))}
                </div>

                {/* Safety Medical Disclaimer */}
                <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4 sm:p-5 flex items-start gap-3.5">
                  <svg className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-primary-950 mb-1">
                      Informational Safety Disclaimer
                    </h5>
                    <p className="text-xs text-primary-900 leading-relaxed">
                      {STANDARD_MEDICAL_DISCLAIMER} Trends compare recorded laboratory values over time and do not predict future health outcomes or disease trajectories.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function TestTrendCard({ summary }: { summary: TestTrendSummary }) {
  return (
    <Card className="overflow-hidden border border-gray-200 shadow-sm">
      <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
            🧪
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{summary.test_name}</h3>
            <p className="text-xs text-gray-500">
              Canonical unit: <span className="font-mono text-gray-700">{summary.canonical_unit || "Unspecified"}</span> • {summary.data_points.length} measurement{summary.data_points.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary.has_incomparable_points && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
              ⚠️ Incompatible units detected
            </span>
          )}
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              summary.latest_status === "normal"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : summary.latest_status === "high"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : summary.latest_status === "low"
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }`}
          >
            Latest: {summary.latest_status.toUpperCase()}
          </span>
        </div>
      </div>

      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-white font-semibold text-gray-600 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Date / Report</th>
                <th className="py-3 px-4">Observed Value</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Lab Range</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Change vs Previous</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {summary.comparisons.map((comp, idx) => {
                const pt = comp.current;
                const isNormal = pt.status === "normal";
                const isHigh = pt.status === "high";
                const isLow = pt.status === "low";

                return (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    {/* Date & Report Link */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {pt.report_date || new Date(pt.created_at).toLocaleDateString()}
                      </div>
                      <Link
                        to={`/reports/${pt.report_id}`}
                        className="text-[11px] text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1 mt-0.5 font-mono"
                      >
                        📄 {pt.report_filename}
                      </Link>
                    </td>

                    {/* Value */}
                    <td className="py-3 px-4 font-bold text-gray-900 text-sm">
                      {pt.raw_value}
                    </td>

                    {/* Unit */}
                    <td className="py-3 px-4 text-gray-600 font-mono">
                      {pt.unit || "—"}
                    </td>

                    {/* Range */}
                    <td className="py-3 px-4 text-gray-500">
                      {pt.reference_range || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {isNormal && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Normal
                        </span>
                      )}
                      {isHigh && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          High
                        </span>
                      )}
                      {isLow && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Low
                        </span>
                      )}
                      {!isNormal && !isHigh && !isLow && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Unspecified
                        </span>
                      )}
                    </td>

                    {/* Change / Comparison */}
                    <td className="py-3 px-4 text-right">
                      {idx === 0 ? (
                        <span className="text-gray-400 font-normal italic">Baseline</span>
                      ) : comp.is_comparable ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              comp.direction === "higher"
                                ? "text-amber-700"
                                : comp.direction === "lower"
                                ? "text-indigo-700"
                                : "text-gray-600"
                            }`}
                          >
                            {comp.direction === "higher" && "▲"}
                            {comp.direction === "lower" && "▼"}
                            {comp.direction === "unchanged" && "—"}
                            {comp.difference != null && (
                              <span>
                                {comp.difference > 0 ? `+${comp.difference}` : comp.difference}
                              </span>
                            )}
                          </span>
                          {comp.percent_change != null && (
                            <span className="text-[10px] text-gray-400">
                              ({comp.percent_change > 0 ? `+${comp.percent_change}` : comp.percent_change}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Not comparable
                          </span>
                          <span className="text-[10px] text-amber-700 mt-0.5 max-w-[180px] text-right truncate" title={comp.non_comparable_reason || ""}>
                            {comp.non_comparable_reason}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
