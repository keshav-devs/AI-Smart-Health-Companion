/**
 * File upload zone with drag-and-drop, format validation, and size checking.
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import {
  MAX_REPORT_FILE_SIZE_BYTES,
  MAX_REPORT_FILE_SIZE_LABEL,
  ALLOWED_REPORT_EXTENSIONS,
  ALLOWED_REPORT_MIME_TYPES,
  ALLOWED_REPORT_FORMATS_LABEL,
} from "@/schemas/report";

interface FileUploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploadZone({
  selectedFile,
  onFileSelect,
  disabled = false,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = (file: File) => {
    setValidationError(null);

    // 1. Check size
    if (file.size === 0) {
      setValidationError("The selected file is empty (0 bytes).");
      onFileSelect(null);
      return;
    }
    if (file.size > MAX_REPORT_FILE_SIZE_BYTES) {
      setValidationError(`File exceeds maximum allowed size of ${MAX_REPORT_FILE_SIZE_LABEL}.`);
      onFileSelect(null);
      return;
    }

    // 2. Check extension & MIME
    const ext = ("." + file.name.split(".").pop()?.toLowerCase()) as unknown;
    const isAllowedExt = (ALLOWED_REPORT_EXTENSIONS as readonly unknown[]).includes(ext);
    const isAllowedMime = (ALLOWED_REPORT_MIME_TYPES as readonly unknown[]).includes(file.type);

    if (!isAllowedExt && !isAllowedMime) {
      setValidationError(`Invalid file type. Only ${ALLOWED_REPORT_FORMATS_LABEL} files are accepted.`);
      onFileSelect(null);
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSet(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSet(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
        id="file-upload-input"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all
            ${
              isDragOver
                ? "border-primary-500 bg-primary-50/60 scale-[1.01]"
                : "border-gray-300 hover:border-primary-400 hover:bg-gray-50/50 bg-white"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-gray-900">
            Click to upload or drag & drop your report
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select or drag a supported blood test document or photo
          </p>

          <div className="mt-4 flex flex-wrap justify-center items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
              Formats: {ALLOWED_REPORT_FORMATS_LABEL}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 font-semibold border border-primary-200">
              Max Size: {MAX_REPORT_FILE_SIZE_LABEL}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
              {selectedFile.type.includes("pdf") ? (
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
              <p className="text-sm font-semibold text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatFileSize(selectedFile.size)} • {selectedFile.type || "Document"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-3 flex-shrink-0"
            title="Remove file"
            aria-label="Remove selected file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {validationError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-sm text-red-700">
          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
