/**
 * Reports list page — displays all blood reports belonging to the user.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportCard } from "@/components/reports/ReportCard";
import { fetchReports } from "@/api/reports";
import { useProfile } from "@/hooks/useProfile";
import type { ApiError } from "@/api/client";

export function ReportsListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["reports", profileId],
    queryFn: fetchReports,
    enabled: !!profileId,
  });

  const reports = data?.reports ?? [];
  const filteredReports = reports.filter((r) => {
    const matchName = r.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = (r.report_type || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchName || matchType;
  });

  return (
    <DashboardLayout>
      <div className="fade-in space-y-6">
        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Blood Reports
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and securely view your uploaded medical reports.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/reports/trends">
              <Button variant="secondary" className="w-full sm:w-auto flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Trends & History
              </Button>
            </Link>
            <Link to="/reports/upload">
              <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Report
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="py-12">
            <LoadingSpinner message="Fetching your reports..." />
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────── */}
        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
            <ErrorMessage
              message={
                (error as unknown as ApiError)?.detail ||
                "Failed to load reports. Please check your connection."
              }
            />
            <Button variant="secondary" onClick={() => refetch()} size="sm">
              Try Again
            </Button>
          </div>
        )}

        {/* ── Loaded Content ─────────────────────────────────────── */}
        {!isLoading && !isError && (
          <>
            {reports.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-12">
                <EmptyState
                  icon={
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  title="No reports uploaded yet"
                  description="Upload your blood work (PDF, JPG, or PNG) to keep them organized and accessible in your companion."
                />
                <div className="mt-6 flex justify-center">
                  <Link to="/reports/upload">
                    <Button>Upload your first report</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search reports by filename or type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>

                  <p className="text-xs sm:text-sm text-gray-500 self-center">
                    Showing <span className="font-semibold text-gray-900">{filteredReports.length}</span> of {reports.length} {reports.length === 1 ? "report" : "reports"}
                  </p>
                </div>

                {/* Reports Grid */}
                {filteredReports.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                    <p className="text-sm font-medium text-gray-700">No reports match your search query.</p>
                    <button
                      onClick={() => setSearchTerm("")}
                      className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReports.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
