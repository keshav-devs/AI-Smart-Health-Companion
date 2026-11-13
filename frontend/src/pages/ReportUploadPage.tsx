/**
 * Report upload page — drag-and-drop file upload with category selector.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FileUploadZone } from "@/components/reports/FileUploadZone";
import { uploadReport } from "@/api/reports";
import {
  COMMON_REPORT_TYPES,
  MAX_REPORT_FILE_SIZE_LABEL,
  ALLOWED_REPORT_FORMATS_LABEL,
} from "@/schemas/report";
import type { ApiError } from "@/api/client";

export function ReportUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<string>("Complete Blood Count (CBC)");
  const [customType, setCustomType] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select a valid report file to upload.");
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    try {
      const finalType = reportType === "Other" ? customType : reportType;
      const report = await uploadReport(selectedFile, finalType);

      // Invalidate reports list cache
      await queryClient.invalidateQueries({ queryKey: ["reports"] });

      // Navigate to the uploaded report's details
      navigate(`/reports/${report.id}`);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr.detail || "Failed to upload report. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="fade-in max-w-2xl mx-auto space-y-6">
        {/* ── Breadcrumb & Title ─────────────────────────────────── */}
        <div>
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <Link to="/reports" className="hover:text-primary-600 transition-colors">
              Reports
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Upload</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Upload Blood Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a PDF or image of your laboratory test results.
          </p>
        </div>

        

        {/* ── Error Banner ───────────────────────────────────────── */}
        {errorMsg && (
          <ErrorMessage message={errorMsg} />
        )}

        {/* ── Upload Form ────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Report Details"
            description="Select the report category and attach your file."
          />
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selector */}
              <div>
                <label
                  htmlFor="report-type"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Report Category / Test Type
                </label>
                <select
                  id="report-type"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  {COMMON_REPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="Other">Other / Custom</option>
                </select>

                {reportType === "Other" && (
                  <input
                    type="text"
                    placeholder="Enter custom report name..."
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    disabled={isUploading}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                )}
              </div>

              {/* File Upload Zone */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="file-upload-input" className="block text-sm font-medium text-gray-700">
                    Attachment File <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-500 font-medium bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full">
                    Formats: <strong className="text-gray-700">{ALLOWED_REPORT_FORMATS_LABEL}</strong> | Max: <strong className="text-primary-700">{MAX_REPORT_FILE_SIZE_LABEL}</strong>
                  </span>
                </div>
                <FileUploadZone
                  selectedFile={selectedFile}
                  onFileSelect={setSelectedFile}
                  disabled={isUploading}
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                <Link to="/reports" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isUploading}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </Link>

                <Button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  isLoading={isUploading}
                  className="w-full sm:w-auto"
                >
                  {isUploading ? "Uploading Report…" : "Upload Report"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}
