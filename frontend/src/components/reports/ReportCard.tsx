import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Report } from "@/schemas/report";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  downloadReportFile,
  getAuthenticatedReportFileUrl,
  analyzeReport,
} from "@/api/reports";
import type { ApiError } from "@/api/client";

interface ReportCardProps {
  report: Report;
}

export function ReportCard({ report }: ReportCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const isPdf = report.mime_type === "application/pdf" || report.filename.endsWith(".pdf");

  // Separate Analyze mutation: calls POST /api/v1/reports/{id}/analyze directly
  // Does NOT open, preview, or download the file!
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeReport(report.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report", report.id] });
      navigate(`/reports/${report.id}`);
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setActionError(
        apiErr.detail ||
          "AI analysis is not configured yet. Configure GEMINI_API_KEY in the backend environment."
      );
    },
  });

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDownloading(true);
    setActionError(null);
    try {
      await downloadReportFile(report.id, report.filename);
    } catch (err) {
      const apiErr = err as unknown as ApiError;
      setActionError(apiErr.detail || "Failed to download report file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = getAuthenticatedReportFileUrl(report.id, "inline");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActionError(null);
    analyzeMutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/reports/${report.id}`}
            className="flex items-start gap-3.5 min-w-0 group"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
              {isPdf ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                {report.filename}
              </h4>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {report.report_type && (
                  <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                    {report.report_type}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatFileSize(report.file_size)}
                </span>
              </div>
            </div>
          </Link>

          <StatusBadge status={report.status} size="sm" />
        </div>

        {/* Error notification banner if any action fails */}
        {actionError && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            {actionError}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Uploaded {formatDate(report.created_at)}</span>
          <Link
            to={`/reports/${report.id}`}
            className="font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Details
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Explicit separate action buttons: Preview, Download, Analyze */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePreview}
            title="Open original report file in new tab"
            className="text-[11px] px-2 py-1.5 flex items-center justify-center gap-1 text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            disabled={isDownloading}
            isLoading={isDownloading}
            title="Download original file to device"
            className="text-[11px] px-2 py-1.5 flex items-center justify-center gap-1 text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending}
            isLoading={analyzeMutation.isPending}
            title="Send report to authenticated AI extraction endpoint"
            className="text-[11px] px-2 py-1.5 flex items-center justify-center gap-1 font-semibold"
          >
            <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Analyze
          </Button>
        </div>
      </div>
    </div>
  );
}
