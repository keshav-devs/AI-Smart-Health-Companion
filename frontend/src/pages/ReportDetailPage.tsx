/**
 * Report detail page — displays metadata, AI extraction review, lab values,
 * document preview viewer, and secure download for a specific report.
 */

import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { StatusBadge } from "@/components/reports/StatusBadge";
import {
  fetchReportDetails,
  fetchReportBlob,
  downloadReportFile,
  getAuthenticatedReportFileUrl,
  analyzeReport,
  confirmExtraction,
  explainReport,
  askReportQuestion,
} from "@/api/reports";
import {
  type LabTestItem,
  type ConfirmExtractionRequest,
  STANDARD_MEDICAL_DISCLAIMER,
} from "@/schemas/report";
import type {
  ReportExplanationResult,
  ReportQuestionResponse,
} from "@/schemas/explanation";
import type { ApiError } from "@/api/client";
import { useProfile } from "@/hooks/useProfile";

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const queryClient = useQueryClient();
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Editable state for review / confirmation mode
  const [reviewTests, setReviewTests] = useState<LabTestItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [labName, setLabName] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  // 1. Fetch Report Metadata
  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["report", profileId, reportId],
    queryFn: () => fetchReportDetails(reportId!),
    enabled: Boolean(profileId) && Boolean(reportId),
  });

  // Populate local edit state when extracted data arrives
  useEffect(() => {
    if (report?.extracted_data) {
      setReviewTests(report.extracted_data.tests || []);
      setPatientName(report.extracted_data.patient_name_detected || "");
      setReportDate(report.extracted_data.report_date_detected || "");
      setLabName(report.extracted_data.lab_name_detected || "");
      setUserNotes(report.extracted_data.summary_notes || "");
    }
  }, [report?.extracted_data]);

  // 2. Fetch Report File for Authenticated Preview
  const {
    data: fileData,
    isLoading: isFileLoading,
    isError: isFileError,
    error: fileError,
    refetch: refetchFile,
  } = useQuery({
    queryKey: ["report-file", profileId, reportId],
    queryFn: () => fetchReportBlob(reportId!, "inline"),
    enabled: Boolean(profileId) && Boolean(reportId) && Boolean(report),
  });

  // Create and clean up Object URL for the blob
  const previewUrl = useMemo(() => {
    if (!fileData?.blob) return null;
    return URL.createObjectURL(fileData.blob);
  }, [fileData?.blob]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 3. Analyze Mutation
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeReport(reportId!),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(["report", profileId, reportId], updatedReport);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setIsEditMode(false);
    },
  });

  // 4. Confirm Mutation
  const confirmMutation = useMutation({
    mutationFn: (confirmData: ConfirmExtractionRequest) =>
      confirmExtraction(reportId!, confirmData),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(["report", profileId, reportId], updatedReport);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setIsEditMode(false);
    },
  });

  // 5. Explanation State & Mutation
  const [localExplanation, setLocalExplanation] = useState<ReportExplanationResult | null>(null);
  const [userQuestion, setUserQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<ReportQuestionResponse[]>([]);

  useEffect(() => {
    if (report?.explanation_data) {
      setLocalExplanation(report.explanation_data);
    }
  }, [report?.explanation_data]);

  const explainMutation = useMutation({
    mutationFn: () => explainReport(reportId!),
    onSuccess: (data) => {
      setLocalExplanation(data);
      queryClient.invalidateQueries({ queryKey: ["report", profileId, reportId] });
    },
  });

  const questionMutation = useMutation({
    mutationFn: (q: string) => askReportQuestion(reportId!, q),
    onSuccess: (res) => {
      setQaHistory((prev) => [res, ...prev]);
      setUserQuestion("");
    },
  });

  const handleDownload = async () => {
    if (!report) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadReportFile(report.id, report.filename);
    } catch (err) {
      const apiErr = err as ApiError;
      setDownloadError(
        apiErr.detail ||
          "Failed to download report file. You may not have permission or the file is unavailable."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirm = () => {
    setFormError(null);
    for (const [idx, t] of reviewTests.entries()) {
      if (!t.test_name.trim()) {
        setFormError(`Item ${idx + 1}: Test name is required.`);
        return;
      }
      if (!t.value.trim()) {
        setFormError(`Item ${idx + 1}: Value is required.`);
        return;
      }
    }

    confirmMutation.mutate({
      tests: reviewTests,
      patient_name_detected: patientName.trim() || null,
      report_date_detected: reportDate.trim() || null,
      lab_name_detected: labName.trim() || null,
      notes: userNotes.trim() || null,
    });
  };

  const handleTestFieldChange = (
    index: number,
    field: keyof LabTestItem,
    val: string | boolean
  ) => {
    setReviewTests((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddTestRow = () => {
    setReviewTests((prev) => [
      ...prev,
      {
        test_name: "New Test",
        value: "",
        unit: "",
        reference_range: "",
        status: "unspecified",
        needs_review: true,
        review_reason: "Manually added field",
      },
    ]);
  };

  const handleRemoveTestRow = (index: number) => {
    setReviewTests((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const isPdf =
    report?.mime_type === "application/pdf" ||
    report?.filename.toLowerCase().endsWith(".pdf");
  const isImage =
    report?.mime_type.startsWith("image/") ||
    /\.(jpe?g|png)$/i.test(report?.filename || "");

  const hasExtractedData = Boolean(report?.extracted_data?.tests?.length);
  const showReviewMode =
    report?.status === "needs_review" || 
    ((report?.status === "analyzed" || report?.status === "manually_entered") && isEditMode) || 
    ((report?.status === "not_analyzed" || report?.status === "failed") && isEditMode);

  return (
    <DashboardLayout>
      <div className="fade-in max-w-4xl mx-auto space-y-6">
        {/* ── Breadcrumb & Top Bar ──────────────────────────────── */}
        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs text-gray-500">
            <Link to="/reports" className="hover:text-primary-600 transition-colors">
              Reports
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-xs">
              {report?.filename || "Report Details"}
            </span>
          </nav>

          <Link to="/reports">
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to reports
            </Button>
          </Link>
        </div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="py-16">
            <LoadingSpinner message="Loading report details..." />
          </div>
        )}

        {/* ── Main Error State ───────────────────────────────────── */}
        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-4">
            <ErrorMessage
              message={
                (error as unknown as ApiError)?.detail ||
                "Report not found or you do not have permission to view it."
              }
            />
            <div className="flex gap-3">
              <Button size="sm" variant="secondary" onClick={() => refetch()}>
                Try again
              </Button>
              <Link to="/reports">
                <Button size="sm" variant="ghost">
                  Go to reports list
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Report Content ─────────────────────────────────────── */}
        {!isLoading && !isError && report && (
          <>
            {/* Header Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  {isPdf ? (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
                    {report.filename}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {report.report_type && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                        {report.report_type}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      Uploaded on {formatDate(report.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Actions: Preview, Download, Analyze (separate actions) + Trends */}
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={getAuthenticatedReportFileUrl(report.id, "inline")}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                    title="Preview original report document in new browser tab"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </Button>
                </a>

                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  isLoading={isDownloading}
                  variant="secondary"
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                  title="Save original file to device"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </Button>

                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  isLoading={analyzeMutation.isPending}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                  title="Call authenticated analyze endpoint to extract lab values"
                >
                  <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyze
                </Button>

                <Link to="/reports/trends" className="w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-primary-700 hover:bg-primary-50"
                    title="View historical biomarker trends across confirmed reports"
                  >
                    <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Trends
                  </Button>
                </Link>
              </div>
            </div>

            {downloadError && (
              <ErrorMessage message={downloadError} onRetry={handleDownload} />
            )}

            {/* ── Status Banner & Trigger Card ──────────────────────── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-gray-900">
                      Report Analysis
                    </h2>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {report.status === "not_analyzed" &&
                      "This report has not been analyzed yet. Run AI extraction to detect test names, values, and reference ranges."}
                    {report.status === "processing" &&
                      "AI extraction is in progress. Please wait..."}
                    {report.status === "needs_review" &&
                      "Extraction complete! Please review and verify the extracted values below before confirming."}
                    {report.status === "analyzed" &&
                      `Extraction confirmed by you on ${formatDate(report.reviewed_at || report.updated_at)}.`}
                    {report.status === "manually_entered" &&
                      `Values manually entered by you on ${formatDate(report.reviewed_at || report.updated_at)}.`}
                    {report.status === "failed" &&
                      "The extraction encountered an error. You can review the details below and try again, or enter the results manually."}
                  </p>
                </div>

                {/* Primary Action Button */}
                {(report.status === "not_analyzed" || report.status === "failed") && !isEditMode && (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      onClick={() => setIsEditMode(true)}
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      Enter results manually
                    </Button>
                    <Button
                      onClick={() => analyzeMutation.mutate()}
                      isLoading={analyzeMutation.isPending}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Analyze with AI
                    </Button>
                  </div>
                )}
              </div>

              {/* Extraction Error Display */}
              {(report.extraction_error || analyzeMutation.isError) && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    AI Extraction Not Available
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {report.extraction_error ||
                      (analyzeMutation.error as unknown as ApiError)?.detail ||
                      "AI analysis is not configured yet. Configure GEMINI_API_KEY in the backend environment."}
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Safety guarantee: No sample or made-up lab values are displayed when AI extraction is unconfigured.
                  </p>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => analyzeMutation.mutate()}
                      isLoading={analyzeMutation.isPending}
                    >
                      Try Analysis Again
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Review / Edit Extraction Mode ─────────────────────── */}
            {showReviewMode && (
              <Card className="border-purple-200 bg-purple-50/20">
                <CardHeader
                  title={report.status === "not_analyzed" || report.status === "failed" ? "Enter Lab Results" : "Verify Lab Results"}
                  description={report.status === "not_analyzed" || report.status === "failed" ? "Enter test names, values, units, and printed ranges from your document manually." : "Check each test name, value, unit, and reference range against your document. Correct any fields before confirming."}
                />
                <CardBody className="space-y-6">
                  {/* Detected Header Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-white border border-gray-200">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Patient Name (Detected)
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Visible patient name"
                        className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Report Date (Detected)
                      </label>
                      <input
                        type="text"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        placeholder="e.g. 2026-10-01"
                        className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Lab Name (Detected)
                      </label>
                      <input
                        type="text"
                        value={labName}
                        onChange={(e) => setLabName(e.target.value)}
                        placeholder="Laboratory / Clinic"
                        className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Test Items Table / List */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                      <thead className="bg-gray-50 font-semibold text-gray-700">
                        <tr>
                          <th className="py-3 px-3">Test Name</th>
                          <th className="py-3 px-3 w-28">Value</th>
                          <th className="py-3 px-3 w-24">Unit</th>
                          <th className="py-3 px-3 w-32">Lab Range</th>
                          <th className="py-3 px-3 w-28">Status</th>
                          <th className="py-3 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reviewTests.map((item, idx) => (
                          <tr
                            key={idx}
                            className={
                              item.needs_review
                                ? "bg-amber-50/50 hover:bg-amber-50"
                                : "hover:bg-gray-50/50"
                            }
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.test_name}
                                onChange={(e) =>
                                  handleTestFieldChange(idx, "test_name", e.target.value)
                                }
                                className="w-full font-medium text-gray-900 rounded border border-gray-200 px-2 py-1 text-xs"
                              />
                              {item.needs_review && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 mt-1">
                                  ⚠️ {item.review_reason || "Needs review"}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.value}
                                onChange={(e) =>
                                  handleTestFieldChange(idx, "value", e.target.value)
                                }
                                className="w-full font-bold text-gray-900 rounded border border-gray-200 px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.unit || ""}
                                onChange={(e) =>
                                  handleTestFieldChange(idx, "unit", e.target.value)
                                }
                                placeholder="—"
                                className="w-full text-gray-600 rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.reference_range || ""}
                                onChange={(e) =>
                                  handleTestFieldChange(idx, "reference_range", e.target.value)
                                }
                                placeholder="—"
                                className="w-full text-gray-600 rounded border border-gray-200 px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  handleTestFieldChange(
                                    idx,
                                    "status",
                                    e.target.value as LabTestItem["status"]
                                  )
                                }
                                className="text-xs rounded border border-gray-200 px-2 py-1 bg-white text-gray-700"
                              >
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="low">Low</option>
                                <option value="unspecified">Unspecified</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveTestRow(idx)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded"
                                title="Remove test item"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddTestRow}
                      className="flex items-center gap-1.5"
                    >
                      + Add Item
                    </Button>

                    <span className="text-xs text-gray-400">
                      {reviewTests.length} item{reviewTests.length === 1 ? "" : "s"} listed
                    </span>
                  </div>

                  {/* Informational Disclaimer Banner */}
                  {(report.status !== "not_analyzed" && report.status !== "failed" && report.extracted_data?.provenance !== "manual") && (
                    <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 flex items-start gap-3">
                      <svg className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-primary-950 leading-relaxed">
                        {STANDARD_MEDICAL_DISCLAIMER}
                      </p>
                    </div>
                  )}

                  {formError && (
                    <ErrorMessage message={formError} />
                  )}

                  {/* Confirm Action Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                    {report.status === "analyzed" && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsEditMode(false)}
                      >
                        Cancel Editing
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={handleConfirm}
                      isLoading={confirmMutation.isPending}
                      className="w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm & Save Analyzed Data
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── Confirmed Analyzed Results View ───────────────────── */}
            {(report.status === "analyzed" || report.status === "manually_entered") && !isEditMode && hasExtractedData && (
              <Card>
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {report.status === "manually_entered" ? "Manually Entered Laboratory Values" : "Extracted Laboratory Values"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {report.status === "manually_entered" ? "Entered by user on " : "Confirmed by user on "}
                      {formatDate(report.reviewed_at || report.updated_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => explainMutation.mutate()}
                      isLoading={explainMutation.isPending}
                      className="flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {localExplanation ? "Re-Explain Results" : "Explain Results with AI"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditMode(true)}
                      className="flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit / Correct
                    </Button>
                  </div>
                </div>
                <CardBody className="space-y-6">
                  {/* Detected Patient / Lab Metadata */}
                  {(report.extracted_data?.patient_name_detected ||
                    report.extracted_data?.lab_name_detected ||
                    report.extracted_data?.report_date_detected) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                      {report.extracted_data.patient_name_detected && (
                        <div>
                          <span className="text-gray-400 block">Patient</span>
                          <span className="font-semibold text-gray-800">
                            {report.extracted_data.patient_name_detected}
                          </span>
                        </div>
                      )}
                      {report.extracted_data.report_date_detected && (
                        <div>
                          <span className="text-gray-400 block">Date</span>
                          <span className="font-semibold text-gray-800">
                            {report.extracted_data.report_date_detected}
                          </span>
                        </div>
                      )}
                      {report.extracted_data.lab_name_detected && (
                        <div>
                          <span className="text-gray-400 block">Laboratory</span>
                          <span className="font-semibold text-gray-800">
                            {report.extracted_data.lab_name_detected}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clean Lab Results Table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                      <thead className="bg-gray-50 font-semibold text-gray-700">
                        <tr>
                          <th className="py-3 px-4">Test Name</th>
                          <th className="py-3 px-4">Value</th>
                          <th className="py-3 px-4">Unit</th>
                          <th className="py-3 px-4">Printed Range</th>
                          <th className="py-3 px-4 text-right">Interpretation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {report.extracted_data?.tests.map((test, i) => {
                          const isHigh = test.status === "high";
                          const isLow = test.status === "low";
                          const isNormal = test.status === "normal";

                          return (
                            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900">
                                {test.test_name}
                              </td>
                              <td className="py-3 px-4 font-bold text-gray-900">
                                {test.value}
                              </td>
                              <td className="py-3 px-4 text-gray-500 font-mono">
                                {test.unit || "—"}
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {test.reference_range || "—"}
                              </td>
                              <td className="py-3 px-4 text-right">
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Informational Disclaimer Banner */}
                  <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-primary-950 leading-relaxed">
                      {STANDARD_MEDICAL_DISCLAIMER}
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── AI Explanation Loading State ──────────────────────── */}
            {explainMutation.isPending && (
              <Card className="border-primary-200 bg-primary-50/20">
                <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-9 h-9 rounded-full border-3 border-primary-200 border-t-primary-600 animate-spin" />
                  <p className="text-sm font-semibold text-gray-900">
                    Generating Educational Explanation…
                  </p>
                  <p className="text-xs text-gray-500 max-w-md">
                    Reviewing confirmed test results, units, and laboratory reference ranges to provide plain-language terminology definitions.
                  </p>
                </div>
              </Card>
            )}

            {/* ── AI Explanation Error / Unconfigured State ──────────── */}
            {explainMutation.isError && (
              <Card className="border-amber-200 bg-amber-50/40">
                <CardBody className="p-6">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-950">
                        AI Explanation Is Not Configured Yet
                      </h4>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        {(explainMutation.error as unknown as ApiError)?.detail ||
                          "The AI explanation service is not configured yet. Configure GEMINI_API_KEY in the backend environment."}
                      </p>
                      <p className="text-[11px] text-amber-700 mt-2">
                        Safety guarantee: The application will never substitute fake test data or fabricate medical claims when the AI provider is unavailable.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── Confirmed Report AI Explanation View ───────────────── */}
            {report.status === "analyzed" && localExplanation && (
              <Card className="border-primary-100">
                <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse" />
                      <h3 className="text-base font-semibold text-gray-900">
                        Plain-Language Report Explanation
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Educational definitions and objective range comparisons based strictly on this report.
                    </p>
                  </div>
                  {localExplanation.report_date && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                      Cited Date: {localExplanation.report_date}
                    </span>
                  )}
                </div>

                <CardBody className="space-y-6">
                  {/* Summary Box */}
                  <div className="rounded-xl bg-gradient-to-r from-primary-50/60 to-white border border-primary-100 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-800 mb-2">
                      Overview Summary
                    </h4>
                    <p className="text-sm text-gray-800 leading-relaxed font-normal">
                      {localExplanation.summary}
                    </p>
                  </div>

                  {/* Key Findings */}
                  {localExplanation.key_findings && localExplanation.key_findings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Observed Range Outliers
                      </h4>
                      <ul className="space-y-2">
                        {localExplanation.key_findings.map((finding, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-xs text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100"
                          >
                            <span className="text-primary-600 font-bold">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Test-by-Test Definitions & Interpretations */}
                  {localExplanation.test_explanations && localExplanation.test_explanations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Test Definitions & Range Context
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localExplanation.test_explanations.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border border-gray-200 bg-white hover:border-primary-200 transition-colors shadow-sm space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="font-semibold text-gray-900 text-sm">
                                {item.test_name}
                              </h5>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  item.status === "normal"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : item.status === "high"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : item.status === "low"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}
                              >
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono">
                              Value: <strong className="text-gray-900 font-bold">{item.observed_value}</strong> {item.unit || ""} (Range: {item.reference_range || "N/A"})
                            </p>
                            <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <strong className="text-gray-900">What it is:</strong> {item.explanation}
                            </p>
                            <p className="text-xs text-primary-900 leading-relaxed bg-primary-50/50 p-2.5 rounded-lg border border-primary-100">
                              <strong className="text-primary-950">Result context:</strong> {item.interpretation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Limitations note */}
                  {localExplanation.limitations && (
                    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
                      <strong className="text-gray-900">Information Scope:</strong> {localExplanation.limitations}
                    </div>
                  )}

                  {/* Medical Disclaimer */}
                  <div className="p-4 rounded-xl bg-primary-50/40 border border-primary-200 flex items-start gap-3 text-xs text-primary-950 leading-relaxed">
                    <svg className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{localExplanation.disclaimer}</span>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── Report-Specific Follow-Up Q&A Widget ───────────────── */}
            {report.status === "analyzed" && (
              <Card>
                <CardHeader
                  title="Ask Questions About This Report"
                  description="Ask about specific lab terms or recorded values. Responses are strictly educational and scoped to this report."
                />
                <CardBody className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (userQuestion.trim()) {
                        questionMutation.mutate(userQuestion.trim());
                      }
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      placeholder="e.g. What does my hemoglobin level mean?"
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm"
                      disabled={questionMutation.isPending}
                    />
                    <Button
                      type="submit"
                      disabled={!userQuestion.trim() || questionMutation.isPending}
                      isLoading={questionMutation.isPending}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      Ask AI
                    </Button>
                  </form>

                  {/* Question Error */}
                  {questionMutation.isError && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      {(questionMutation.error as unknown as ApiError)?.detail ||
                        "AI question answering is not configured yet. Set GEMINI_API_KEY in the backend configuration."}
                    </div>
                  )}

                  {/* Q&A Thread History */}
                  {qaHistory.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {qaHistory.map((qa, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2 text-xs shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary-700">Q:</span>
                            <span className="font-medium text-gray-900">{qa.question}</span>
                          </div>
                          <div className="text-gray-700 leading-relaxed bg-white p-3 rounded-lg border border-gray-100">
                            {qa.answer}
                          </div>
                          {qa.cited_tests && qa.cited_tests.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-gray-500">
                              <span>Cited tests:</span>
                              {qa.cited_tests.map((test, tidx) => (
                                <span
                                  key={tidx}
                                  className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium"
                                >
                                  {test}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {/* ── Document Preview Section ───────────────────────────── */}
            <Card>
              <CardHeader
                title="Original Document Preview"
                description={`Interactive preview of ${report.filename} (${report.mime_type}).`}
              />
              <CardBody className="p-0">
                {/* Preview Loading State */}
                {isFileLoading && (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <div className="w-9 h-9 rounded-full border-3 border-gray-200 border-t-primary-600 animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">
                      Retrieving file preview securely…
                    </p>
                  </div>
                )}

                {/* Preview Error State */}
                {isFileError && (
                  <div className="p-6">
                    <div className="rounded-2xl bg-red-50/80 border border-red-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-950">
                            Failed to retrieve report preview
                          </p>
                          <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                            {(fileError as unknown as ApiError)?.detail ||
                              "The file could not be accessed. Ensure you are signed in to the account that owns this report and try again."}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => refetchFile()}>
                        Retry Preview
                      </Button>
                    </div>
                  </div>
                )}

                {/* Preview Success State */}
                {!isFileLoading && !isFileError && previewUrl && (
                  <div className="p-4 sm:p-6 bg-gray-50/50">
                    {isPdf ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                          <span className="font-medium text-gray-700">PDF Viewer</span>
                          <span className="text-gray-400">Rendered in authenticated browser frame</span>
                        </div>
                        <iframe
                          src={previewUrl}
                          title={`PDF Preview for ${report.filename}`}
                          className="w-full h-[650px] rounded-xl border border-gray-200 bg-white shadow-inner"
                        />
                      </div>
                    ) : isImage ? (
                      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[350px]">
                        <img
                          src={previewUrl}
                          alt={report.filename}
                          className="max-h-[600px] w-auto max-w-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <p className="text-sm">Preview not supported for this file type.</p>
                        <Button size="sm" variant="secondary" onClick={handleDownload} className="mt-3">
                          Download file instead
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* ── Metadata Card ──────────────────────────────────────── */}
            <Card>
              <CardHeader
                title="File & Storage Metadata"
                description="Technical specifications and file integrity attributes."
              />
              <CardBody className="p-0">
                <dl className="divide-y divide-gray-100">
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">Original Filename</dt>
                    <dd className="text-sm text-gray-900 sm:col-span-2 break-all font-mono">{report.filename}</dd>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">Report Category</dt>
                    <dd className="text-sm text-gray-900 sm:col-span-2">{report.report_type || "General Blood Work"}</dd>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">MIME Content Type</dt>
                    <dd className="text-sm text-gray-900 sm:col-span-2 font-mono">{report.mime_type}</dd>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">File Size</dt>
                    <dd className="text-sm text-gray-900 sm:col-span-2">{formatFileSize(report.file_size)} ({report.file_size.toLocaleString()} bytes)</dd>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">Uploaded At</dt>
                    <dd className="text-sm text-gray-900 sm:col-span-2">{formatDate(report.created_at)}</dd>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                    <dt className="text-sm font-medium text-gray-500">System Report ID</dt>
                    <dd className="text-sm text-gray-500 sm:col-span-2 font-mono text-xs">{report.id}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
