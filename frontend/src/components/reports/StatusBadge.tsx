/**
 * Report processing status badge.
 * Shows Not analyzed, Processing, Needs review, Analyzed, or Failed.
 */

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses =
    size === "sm"
      ? "text-xs px-2.5 py-0.5"
      : "text-xs sm:text-sm px-3 py-1";

  if (status === "not_analyzed" || status === "pending") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Not analyzed yet
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-sky-50 text-sky-800 border border-sky-200 ${sizeClasses}`}
      >
        <svg
          className="w-3.5 h-3.5 animate-spin text-sky-600"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
        Analyzing with AI...
      </span>
    );
  }

  if (status === "needs_review") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-purple-50 text-purple-800 border border-purple-200 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        Needs Review
      </span>
    );
  }

  if (status === "analyzed") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClasses}`}
      >
        <svg
          className="w-3.5 h-3.5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Analyzed
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-red-50 text-red-800 border border-red-200 ${sizeClasses}`}
      >
        <svg
          className="w-3.5 h-3.5 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        Analysis Failed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200 ${sizeClasses}`}
    >
      {status}
    </span>
  );
}
