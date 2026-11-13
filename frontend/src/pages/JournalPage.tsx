import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { journalApi, JournalEntryResponse, JournalEntryCreate, JournalEntryUpdate } from "@/api/journal";
import { useProfile } from "@/hooks/useProfile";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import type { ApiError } from "@/api/client";

export function JournalPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntryResponse | null>(null);

  const { data: entries, isLoading, isError, error } = useQuery({
    queryKey: ["journal", profileId],
    queryFn: () => (profileId ? journalApi.getEntries(profileId) : []),
    enabled: !!profileId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => journalApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", profileId] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this journal entry?")) {
      deleteMutation.mutate(id);
    }
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: JournalEntryResponse) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lifestyle & Symptom Journal</h1>
          <p className="mt-1 text-sm text-gray-500">Track your daily mood, sleep, and symptoms over time.</p>
        </div>
        <Button onClick={openAddModal} disabled={!profileId}>
          Add Entry
        </Button>
      </div>
      
      {deleteMutation.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {(deleteMutation.error as unknown as ApiError)?.detail || "Failed to delete entry."}
        </div>
      )}

      {isError && (
        <div className="mb-4">
          <ErrorMessage message={(error as unknown as ApiError)?.detail || "Failed to load journal entries."} />
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["journal", profileId] })} variant="secondary" className="mt-2">
            Retry
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {entries && entries.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <li key={entry.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{entry.date}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Mood: {entry.mood || "N/A"} • Sleep: {entry.sleep_hours !== null && entry.sleep_hours !== undefined ? `${entry.sleep_hours} hrs` : "N/A"}
                    </div>
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {entry.symptoms.map(s => (
                          <span key={s} className="px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs">{s}</span>
                        ))}
                      </div>
                    )}
                    {entry.notes && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{entry.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 sm:self-start self-end">
                    <Button variant="secondary" size="sm" onClick={() => openEditModal(entry)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(entry.id)} disabled={deleteMutation.isPending}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No journal entries found. Click "Add Entry" to create one.
            </div>
          )}
        </div>
      )}

      {isModalOpen && profileId && (
        <JournalModal
          profileId={profileId}
          entry={editingEntry}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["journal", profileId] });
          }}
        />
      )}
    </DashboardLayout>
  );
}

interface JournalModalProps {
  profileId: string;
  entry: JournalEntryResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

function JournalModal({ profileId, entry, onClose, onSuccess }: JournalModalProps) {
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split("T")[0]);
  const [mood, setMood] = useState(entry?.mood || "");
  const [sleepHours, setSleepHours] = useState<string>(entry?.sleep_hours?.toString() || "");
  const [symptomsInput, setSymptomsInput] = useState(entry?.symptoms?.join(", ") || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: JournalEntryCreate) => journalApi.createEntry(data),
    onSuccess: () => onSuccess(),
    onError: (err) => setSubmitError((err as unknown as ApiError)?.detail || "Failed to save entry."),
  });

  const updateMutation = useMutation({
    mutationFn: (data: JournalEntryUpdate) => journalApi.updateEntry(entry!.id, data),
    onSuccess: () => onSuccess(),
    onError: (err) => setSubmitError((err as unknown as ApiError)?.detail || "Failed to update entry."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setValidationError(null);

    const parsedSleep = sleepHours.trim() ? parseFloat(sleepHours) : null;
    if (parsedSleep !== null && (isNaN(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)) {
      setValidationError("Sleep hours must be a number between 0 and 24.");
      return;
    }
    
    if (mood.length > 50) {
      setValidationError("Mood must not exceed 50 characters.");
      return;
    }
    
    if (notes.length > 2000) {
      setValidationError("Notes must not exceed 2,000 characters.");
      return;
    }

    const symptomsList = symptomsInput
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const payload = {
      date,
      mood: mood.trim() || undefined,
      sleep_hours: parsedSleep !== null ? parsedSleep : undefined,
      symptoms: symptomsList.length > 0 ? symptomsList : undefined,
      notes: notes.trim() || undefined,
    };

    if (entry) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, profile_id: profileId });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{entry ? "Edit Journal Entry" : "Add Journal Entry"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">✕</button>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}
        {validationError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1 text-sm">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-gray-700 mb-1 text-sm">Mood</label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                maxLength={50}
                placeholder="e.g. Good, Tired"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1 text-sm">Sleep (hours)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="e.g. 7.5"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1 text-sm">Symptoms (comma-separated)</label>
            <input
              type="text"
              value={symptomsInput}
              onChange={(e) => setSymptomsInput(e.target.value)}
              placeholder="e.g. Headache, Nausea"
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1 text-sm">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Any additional details..."
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
