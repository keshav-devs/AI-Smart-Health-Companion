import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { fetchHealthTimeline, type TimelineCategory } from "@/api/timeline";
import { useProfile } from "@/hooks/useProfile";

const categoryLabels: Record<TimelineCategory, string> = {
  report: "Report",
  document: "Document",
  medicine: "Medicine",
  dose: "Dose",
  journal: "Journal",
};

export function HealthHistoryPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["health-timeline", profileId],
    queryFn: () => fetchHealthTimeline(100),
    enabled: !!profileId,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Health History</h1>
          <p className="mt-1 text-sm text-gray-500">A chronological view of activity for {currentProfile?.name || "the selected profile"}.</p>
        </header>
        {isLoading ? <LoadingSpinner /> : isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load health history. Please try again.</div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Your saved reports, documents, medicines, journal entries, and dose records will appear here.</div>
        ) : (
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{categoryLabels[event.category]}</span>
                      <h2 className="font-semibold text-gray-900">{event.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{event.summary}</p>
                  </div>
                  <time className="shrink-0 text-xs text-gray-500" dateTime={event.occurred_at}>
                    {new Date(event.occurred_at).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </DashboardLayout>
  );
}
