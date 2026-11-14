/**
 * Dashboard page — shows honest empty states for a new user.
 * No fake data, no placeholder integrations.
 */

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { fetchReports } from "@/api/reports";
import { fetchMedicines, fetchTodayDoses } from "@/api/medicines";
import { ReportCard } from "@/components/reports/ReportCard";
import { useProfile } from "@/hooks/useProfile";
import { fetchHealthTimeline } from "@/api/timeline";

export function DashboardPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const { data: reportsData } = useQuery({
    queryKey: ["reports", profileId],
    queryFn: fetchReports,
    enabled: !!profileId,
  });

  const { data: medsData } = useQuery({
    queryKey: ["medicines", profileId],
    queryFn: () => fetchMedicines(false),
    enabled: !!profileId,
  });

  const { data: dosesData } = useQuery({
    queryKey: ["today-doses", profileId],
    queryFn: () => fetchTodayDoses(),
    enabled: !!profileId,
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["health-timeline", profileId],
    queryFn: () => fetchHealthTimeline(8),
    enabled: !!profileId,
  });

  const reports = reportsData?.reports ?? [];
  const reportsCount = reports.length;
  const medsCount = medsData?.total ?? 0;
  const dosesRemaining = (dosesData?.pending_count ?? 0) + (dosesData?.missed_count ?? 0);

  return (
    <DashboardLayout>
      <div className="fade-in space-y-8">
        {/* ── Welcome header ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome, {firstName} 👋
            </h1>
            <p className="mt-1.5 text-gray-500">
              Here&apos;s an overview of your health journey.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/reports/trends">
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Trends
              </Button>
            </Link>
            <Link to="/medicines">
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Medicines
              </Button>
            </Link>
            <Link to="/reports/upload">
              <Button className="w-full sm:w-auto flex items-center justify-center gap-2" size="sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Report
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Quick info cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/reports" className="block">
            <QuickCard
              label="Blood Reports"
              value={reportsCount > 0 ? String(reportsCount) : "0"}
              note={reportsCount > 0 ? `${reportsCount} reports (view all)` : "Upload report"}
              color="primary"
            />
          </Link>
          <Link to="/reports/trends" className="block">
            <QuickCard
              label="Biomarker Trends"
              value={reportsCount > 0 ? "Active" : "—"}
              note={reportsCount > 0 ? "Track lab changes over time" : "Requires confirmed reports"}
              color="accent"
            />
          </Link>
          <Link to="/medicines" className="block">
            <QuickCard
              label="Medicines"
              value={medsCount > 0 ? String(medsCount) : "0"}
              note={
                medsCount > 0
                  ? `${dosesRemaining} doses remaining today`
                  : "Track daily prescriptions"
              }
              color="primary"
            />
          </Link>
          <div className="block cursor-default">
            <QuickCard
              label="Upcoming Appointments"
              value="—"
              note="No appointments scheduled"
              color="gray"
            />
          </div>
        </div>

        {/* ── Main Reports Section ─────────────────────────────── */}
        <Card>
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Health Reports</h3>
              <p className="text-xs text-gray-500 mt-0.5">Securely manage your medical blood reports.</p>
            </div>
            {reportsCount > 0 && (
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all ({reportsCount})
                </Button>
              </Link>
            )}
          </div>
          <CardBody>
            {reportsCount === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icon={
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  title="No reports uploaded"
                  description="When you upload medical reports, they'll appear here for secure storage and tracking."
                />
                <div className="flex justify-center">
                  <Link to="/reports/upload">
                    <Button size="sm">Upload your first report</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.slice(0, 2).map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Recent profile activity ─────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <CardHeader title="Recent Health History" description="Recent activity for the selected profile." />
            <Link to="/health-history" className="text-sm font-medium text-primary-700 hover:text-primary-800">View timeline</Link>
          </div>
          <CardBody>
            {timelineLoading ? <p className="text-sm text-gray-500">Loading recent activity…</p> : timeline.length ? (
              <ol className="divide-y divide-gray-100">
                {timeline.slice(0, 6).map((event) => (
                  <li key={event.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{event.title}</p>
                      <p className="text-xs text-gray-500">{event.summary}</p>
                    </div>
                    <time className="text-xs text-gray-500" dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="No activity yet"
                description="Saved health records and activity for this profile will appear here."
              />
            )}
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/* ── Quick summary card ────────────────────────────────────────────── */

interface QuickCardProps {
  label: string;
  value: string;
  note: string;
  color: "primary" | "accent" | "gray";
}

const colorMap = {
  primary: {
    bg: "bg-primary-50",
    text: "text-primary-700",
    border: "border-primary-100",
  },
  accent: {
    bg: "bg-accent-50",
    text: "text-accent-700",
    border: "border-accent-100",
  },
  gray: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-100",
  },
};

function QuickCard({ label, value, note, color }: QuickCardProps) {
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 transition-shadow hover:shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{note}</p>
    </div>
  );
}
