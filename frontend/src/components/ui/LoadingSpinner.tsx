/**
 * Full-page loading spinner.
 */

export function LoadingSpinner({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 border-t-primary-600 spinner" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
