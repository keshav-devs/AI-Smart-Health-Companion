/**
 * Medicines & Reminders Page — Milestone 5.
 * Provides medicine inventory, schedule management, today's dose tracking,
 * and adherence analytics. Scoped to authenticated user with honest provider status.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchMedicines,
  createMedicine,
  deleteMedicine,
  fetchTodayDoses,
  logDose,
  fetchAdherenceHistory,
  fetchMedicineAlerts,
  fetchReminderStatus,
} from "@/api/medicines";
import type {
  Medicine,
  MedicineCreatePayload,
  TodayDoseItem,
} from "@/schemas/medicine";
import type { ApiError } from "@/api/client";
import { useProfile } from "@/hooks/useProfile";

export function MedicinesPage() {
  const queryClient = useQueryClient();
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [adherenceDays, setAdherenceDays] = useState(30);

  // 1. Fetch Medicines List
  const {
    data: medicinesData,
    isLoading: isMedsLoading,
    isError: isMedsError,
    error: medsError,
  } = useQuery({
    queryKey: ["medicines", profileId],
    queryFn: () => fetchMedicines(false),
    enabled: !!profileId,
  });

  // 2. Fetch Today's Doses
  const {
    data: todayDosesData,
    isLoading: isDosesLoading,
    refetch: refetchTodayDoses,
  } = useQuery({
    queryKey: ["today-doses", profileId],
    queryFn: () => fetchTodayDoses(),
    enabled: !!profileId,
  });

  // 3. Fetch Adherence Analytics
  const {
    data: adherenceData,
  } = useQuery({
    queryKey: ["adherence", profileId, adherenceDays],
    queryFn: () => fetchAdherenceHistory(adherenceDays),
    enabled: !!profileId,
  });

  // 4. Fetch Refill / Expiry Alerts
  const {
    data: alertsData,
  } = useQuery({
    queryKey: ["medicine-alerts", profileId],
    queryFn: fetchMedicineAlerts,
    enabled: !!profileId,
  });

  // 5. Fetch Reminder Provider Status
  const {
    data: reminderStatus,
  } = useQuery({
    queryKey: ["reminder-status"],
    queryFn: fetchReminderStatus,
  });

  // Log Dose Mutation
  const doseMutation = useMutation({
    mutationFn: ({
      medId,
      scheduledTime,
      status,
    }: {
      medId: string;
      scheduledTime: string;
      status: "taken" | "skipped";
    }) =>
      logDose(medId, {
        scheduled_time: scheduledTime,
        status,
        actual_time: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-doses"] });
      queryClient.invalidateQueries({ queryKey: ["adherence"] });
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["medicine-alerts"] });
    },
  });

  // Delete Medicine Mutation
  const deleteMutation = useMutation({
    mutationFn: (medId: string) => deleteMedicine(medId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["today-doses"] });
      queryClient.invalidateQueries({ queryKey: ["adherence"] });
      queryClient.invalidateQueries({ queryKey: ["medicine-alerts"] });
    },
  });

  const medicines = medicinesData?.medicines ?? [];
  const todayDoses = todayDosesData?.doses ?? [];

  return (
    <DashboardLayout>
      <div className="fade-in space-y-6 max-w-6xl mx-auto">
        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Medicines & Reminders
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track daily doses, intake schedules, and inventory alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Medicine
            </Button>
          </div>
        </div>

        {/* ── Provider Status Banner ─────────────────────────────── */}
        {reminderStatus && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="font-semibold text-gray-900">
                Reminders: {reminderStatus.provider_name}
              </span>
              <span className="text-gray-500 hidden sm:inline">•</span>
              <span className="text-gray-600">{reminderStatus.message}</span>
            </div>
            {!reminderStatus.external_delivery_available && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                In-App Tracking Active
              </span>
            )}
          </div>
        )}

        {/* ── Refill & Expiry Alerts ─────────────────────────────── */}
        {alertsData && (alertsData.low_refill.length > 0 || alertsData.expiring_soon.length > 0 || alertsData.expired.length > 0) && (
          <div className="space-y-3">
            {alertsData.expired.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-3">
                <span className="text-base">⚠️</span>
                <div>
                  <strong className="font-semibold">Expired Medicine Alert:</strong>{" "}
                  {alertsData.expired.map((m) => `${m.name} (expired ${m.expiry_date})`).join(", ")}.
                  Please consult your pharmacist for proper disposal.
                </div>
              </div>
            )}
            {alertsData.expiring_soon.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                <span className="text-base">⏳</span>
                <div>
                  <strong className="font-semibold">Expiring Soon:</strong>{" "}
                  {alertsData.expiring_soon.map((m) => `${m.name} (expires ${m.expiry_date})`).join(", ")}.
                </div>
              </div>
            )}
            {alertsData.low_refill.length > 0 && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                <span className="text-base">📦</span>
                <div>
                  <strong className="font-semibold">Low Supply / Refill Needed:</strong>{" "}
                  {alertsData.low_refill.map((m) => `${m.name} (${m.current_quantity} remaining, threshold ${m.refill_threshold})`).join(", ")}.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Today's Dose Tracker ─────────────────────────────────── */}
        <Card>
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-gray-900">
                  Today's Scheduled Doses
                </h2>
                {todayDosesData && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                    {todayDosesData.taken_count} / {todayDosesData.total_doses} Completed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {todayDosesData?.date
                  ? `Intake schedule for ${todayDosesData.date} (${todayDosesData.timezone})`
                  : "Track intake as you take your doses today."}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchTodayDoses()}
              className="text-xs self-start sm:self-auto"
            >
              Refresh Doses
            </Button>
          </div>

          <CardBody>
            {isDosesLoading ? (
              <div className="py-8">
                <LoadingSpinner message="Checking today's schedule..." />
              </div>
            ) : todayDoses.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 space-y-2">
                <p>No doses scheduled for today.</p>
                {medicines.length === 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    Add a medicine to build your schedule
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {todayDoses.map((dose: TodayDoseItem, idx: number) => {
                  const isTaken = dose.status === "taken";
                  const isSkipped = dose.status === "skipped";
                  const isDue = dose.status === "due";
                  const isMissed = dose.status === "missed";

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isTaken
                          ? "bg-emerald-50/40 border-emerald-200"
                          : isSkipped
                          ? "bg-gray-50 border-gray-200 opacity-75"
                          : isMissed
                          ? "bg-rose-50/40 border-rose-200"
                          : isDue
                          ? "bg-amber-50/30 border-amber-300 ring-1 ring-amber-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                              {dose.time_str}
                            </span>
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {dose.medicine_name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {dose.strength || ""} {dose.form ? `• ${dose.form}` : ""}
                            {dose.instructions ? ` — ${dose.instructions}` : ""}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            isTaken
                              ? "bg-emerald-100 text-emerald-800"
                              : isSkipped
                              ? "bg-gray-200 text-gray-700"
                              : isMissed
                              ? "bg-rose-100 text-rose-800"
                              : isDue
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {dose.status}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-gray-400">
                          {isTaken && dose.logged_at
                            ? `Recorded at ${new Date(dose.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : isSkipped
                            ? "Marked as skipped"
                            : "Scheduled dose"}
                        </span>

                        {!isTaken && !isSkipped && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                doseMutation.mutate({
                                  medId: dose.medicine_id,
                                  scheduledTime: dose.scheduled_time,
                                  status: "skipped",
                                })
                              }
                              disabled={doseMutation.isPending}
                              className="text-[11px] px-2.5 py-1"
                            >
                              Skip
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                doseMutation.mutate({
                                  medId: dose.medicine_id,
                                  scheduledTime: dose.scheduled_time,
                                  status: "taken",
                                })
                              }
                              disabled={doseMutation.isPending}
                              className="text-[11px] px-3 py-1 flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Take
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Adherence & History Summary ─────────────────────────── */}
        {adherenceData && (
          <Card>
            <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Adherence & Intake Analytics
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Calculated strictly from your recorded intake logs over the selected period.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setAdherenceDays(days)}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      adherenceDays === days
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100">
                  <p className="text-xs text-primary-700 font-medium">Adherence Rate</p>
                  <p className="text-2xl font-bold text-primary-900 mt-1">
                    {adherenceData.adherence_rate_percent}%
                  </p>
                  <p className="text-[10px] text-primary-600 mt-0.5">Past {adherenceData.days} days</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Total Scheduled</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {adherenceData.total_scheduled}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Doses planned</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-medium">Taken</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {adherenceData.taken}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Confirmed doses</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Skipped</p>
                  <p className="text-2xl font-bold text-gray-700 mt-1">
                    {adherenceData.skipped}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Logged skips</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <p className="text-xs text-rose-700 font-medium">Missed</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">
                    {adherenceData.missed}
                  </p>
                  <p className="text-[10px] text-rose-600 mt-0.5">Unrecorded</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ── My Medicines Inventory ──────────────────────────────── */}
        <Card>
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                My Medicines ({medicines.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Active prescriptions, supplements, and intake schedules.
              </p>
            </div>
          </div>

          <CardBody>
            {isMedsLoading ? (
              <div className="py-12">
                <LoadingSpinner message="Loading medicines inventory..." />
              </div>
            ) : isMedsError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <ErrorMessage
                  message={
                    (medsError as unknown as ApiError)?.detail ||
                    "Failed to load medicines list."
                  }
                />
              </div>
            ) : medicines.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19.428 15.428a2 2 0 00-2.857 0l-4.57 4.571a2 2 0 102.856 2.857l4.571-4.571a2 2 0 000-2.857zM7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  </svg>
                }
                title="No medicines tracked yet"
                description="Add your prescribed medicines, dosage times, and stock count to start tracking."
                action={
                  <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                    Add your first medicine
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="py-3 px-4">Medicine</th>
                      <th className="py-3 px-4">Dosage & Form</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {medicines.map((med: Medicine) => {
                      const sched = med.schedules?.[0];
                      const isLow =
                        med.current_quantity !== null &&
                        med.current_quantity !== undefined &&
                        med.refill_threshold !== null &&
                        med.refill_threshold !== undefined &&
                        med.current_quantity <= med.refill_threshold;

                      return (
                        <tr key={med.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {med.name}
                            {med.instructions && (
                              <p className="text-[11px] font-normal text-gray-500">
                                {med.instructions}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {med.strength || "—"}{" "}
                            {med.form && <span className="text-gray-400">({med.form})</span>}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {sched ? (
                              <div>
                                <span className="font-medium capitalize text-gray-800">
                                  {sched.frequency.replace("_", " ")}
                                </span>
                                <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                  {sched.specific_times?.join(", ") || "No set times"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">As needed</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {med.current_quantity !== null && med.current_quantity !== undefined ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                                  isLow
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {med.current_quantity} units
                                {isLow && <span className="text-[10px] font-bold">LOW</span>}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {med.expiry_date || "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remove ${med.name} from your medicines?`)) {
                                  deleteMutation.mutate(med.id);
                                }
                              }}
                              className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                              title="Delete medicine"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Add Medicine Modal ──────────────────────────────────── */}
        {isAddModalOpen && (
          <AddMedicineModal
            onClose={() => setIsAddModalOpen(false)}
            onSuccess={() => {
              setIsAddModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ["medicines"] });
              queryClient.invalidateQueries({ queryKey: ["today-doses"] });
              queryClient.invalidateQueries({ queryKey: ["adherence"] });
              queryClient.invalidateQueries({ queryKey: ["medicine-alerts"] });
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ── Add Medicine Modal Component ──────────────────────────────────── */

interface AddMedicineModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddMedicineModal({ onClose, onSuccess }: AddMedicineModalProps) {
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [form, setForm] = useState("Tablet");
  const [instructions, setInstructions] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "twice_daily" | "custom" | "as_needed">("daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [currentQuantity, setCurrentQuantity] = useState<number | "">("");
  const [refillThreshold, setRefillThreshold] = useState<number | "">("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: MedicineCreatePayload) => createMedicine(payload),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setSubmitError(apiErr.detail || "Failed to create medicine.");
    },
  });

  const handleFrequencyChange = (f: "daily" | "twice_daily" | "custom" | "as_needed") => {
    setFrequency(f);
    if (f === "daily") setTimes(["08:00"]);
    else if (f === "twice_daily") setTimes(["08:00", "20:00"]);
    else if (f === "as_needed") setTimes([]);
    else if (f === "custom" && times.length === 0) setTimes(["08:00"]);
  };

  const handleAddTime = () => {
    setTimes((prev) => [...prev, "12:00"]);
  };

  const handleRemoveTime = (index: number) => {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTimeChange = (index: number, val: string) => {
    setTimes((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSubmitError("Medicine name is required.");
      return;
    }

    const payload: MedicineCreatePayload = {
      name: name.trim(),
      strength: strength.trim() || null,
      form: form.trim() || null,
      instructions: instructions.trim() || null,
      current_quantity: currentQuantity === "" ? null : Number(currentQuantity),
      refill_threshold: refillThreshold === "" ? null : Number(refillThreshold),
      expiry_date: expiryDate.trim() || null,
      schedule:
        frequency !== "as_needed" && times.length > 0
          ? {
              frequency,
              times_per_day: times.length,
              specific_times: times,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            }
          : null,
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-in">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Add New Medicine</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Medicine Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atorvastatin or Amoxicillin"
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Strength / Dosage
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 20mg or 500mg"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Form
              </label>
              <select
                value={form}
                onChange={(e) => setForm(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Liquid">Liquid / Syrup</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Injection">Injection</option>
                <option value="Drops">Drops</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Instructions
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take with dinner"
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Schedule section */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <label className="block font-semibold text-gray-800">
              Intake Schedule
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Daily", val: "daily" },
                { label: "Twice Daily", val: "twice_daily" },
                { label: "Custom", val: "custom" },
                { label: "As Needed", val: "as_needed" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.val}
                  onClick={() => handleFrequencyChange(opt.val as any)}
                  className={`py-1.5 px-2 rounded-lg text-center font-medium transition-colors ${
                    frequency === opt.val
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {frequency !== "as_needed" && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] text-gray-500 block">
                  Scheduled time(s) (24-hour format HH:MM):
                </span>
                <div className="flex flex-wrap gap-2 items-center">
                  {times.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => handleTimeChange(idx, e.target.value)}
                        className="text-xs outline-none bg-transparent"
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTime(idx)}
                          className="text-gray-400 hover:text-red-500 text-xs ml-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddTime}
                    className="text-[11px] text-primary-600 font-semibold px-2 py-1 rounded-lg border border-dashed border-primary-300 hover:bg-primary-50"
                  >
                    + Add Time
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inventory & Expiry */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Current Stock
              </label>
              <input
                type="number"
                min="0"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Units left"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Refill Alert At
              </label>
              <input
                type="number"
                min="0"
                value={refillThreshold}
                onChange={(e) => setRefillThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Alert at"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2.5 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Save Medicine
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
