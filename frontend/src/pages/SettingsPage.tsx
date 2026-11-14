import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { createProfile, updateProfile, type Profile, type ProfileCreate } from "@/api/profiles";
import { fetchReports } from "@/api/reports";
import { fetchMedicines } from "@/api/medicines";
import { documentsApi } from "@/api/documents";
import { contactsApi } from "@/api/contacts";
import { doctorQuestionsApi } from "@/api/doctor_questions";
import { journalApi } from "@/api/journal";
import type { ApiError } from "@/api/client";

export function SettingsPage() {
  const { user } = useAuth();
  const { profiles, currentProfile, setCurrentProfile, refreshProfiles } = useProfile();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Parent");
  const [dob, setDob] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  function handleSwitchProfile(profile: Profile) {
    try {
      setProfileError(null);
      setCurrentProfile(profile);
      setProfileSuccess(`Switched to ${profile.name}'s profile.`);
    } catch {
      setProfileError("Could not switch to this profile.");
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: ProfileCreate) => createProfile(payload),
    onSuccess: async (profile) => {
      await refreshProfiles();
      closeForm();
      setCurrentProfile(profile);
      setProfileError(null);
      setProfileSuccess(`Created and switched to ${profile.name}'s profile.`);
    },
    onError: (error) => setFormError((error as unknown as ApiError)?.detail || "Could not create this profile."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; relationship_type?: string; date_of_birth?: string | null; blood_type?: string | null; allergies?: string | null; is_active?: boolean } }) => updateProfile(id, payload),
    onSuccess: async (updated) => {
      await refreshProfiles();
      closeForm();
      if (currentProfile?.id === updated.id && updated.is_active) setCurrentProfile(updated);
      setProfileError(null);
      setProfileSuccess(updated.is_active ? `Updated ${updated.name}'s profile.` : `Deactivated ${updated.name}'s profile.`);
    },
    onError: (error) => setProfileError((error as unknown as ApiError)?.detail || "Could not update this profile."),
  });

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setName("");
    setRelationship("Parent");
    setDob("");
    setBloodType("");
    setAllergies("");
    setFormError(null);
  }
  function startCreate() {
    setEditing(null);
    setName("");
    setRelationship("Parent");
    setDob("");
    setBloodType("");
    setAllergies("");
    setFormError(null);
    setProfileSuccess(null);
    setFormOpen(true);
  }
  function startEdit(profile: Profile) {
    setEditing(profile);
    setName(profile.name);
    setRelationship(profile.relationship_type);
    setDob(profile.date_of_birth || "");
    setBloodType(profile.blood_type || "");
    setAllergies(profile.allergies || "");
    setFormError(null);
    setProfileSuccess(null);
    setFormOpen(true);
  }
  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError("Enter a name for this profile.");
    const payload = {
      name: name.trim(),
      relationship_type: relationship.trim(),
      date_of_birth: dob ? dob : null,
      blood_type: bloodType.trim() ? bloodType.trim() : null,
      allergies: allergies.trim() ? allergies.trim() : null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  }

  async function exportHealthData() {
    if (!currentProfile) return;
    setExportError(null);
    setExporting(true);
    try {
      const [reports, medicines, documents, contacts, questions, journal] = await Promise.all([
        fetchReports(),
        fetchMedicines(false),
        documentsApi.getDocuments(currentProfile.id),
        contactsApi.getContacts(currentProfile.id),
        doctorQuestionsApi.getQuestions(currentProfile.id),
        journalApi.getEntries(currentProfile.id),
      ]);
      const exportData = {
        app: "AI Smart Health Companion",
        exported_at: new Date().toISOString(),
        profile: currentProfile,
        records: {
          reports: reports.reports,
          medicines: medicines.medicines,
          documents,
          contacts,
          doctor_questions: questions,
          journal_entries: journal,
        },
      };
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `health-companion-${currentProfile.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setExportError((error as unknown as ApiError)?.detail || "Could not export this profile's health records.");
    } finally {
      setExporting(false);
    }
  }

  async function deactivateProfile(profile: Profile) {
    if (profile.is_default) return;
    if (!window.confirm(`Deactivate ${profile.name}'s profile? Its saved records will be retained.`)) return;
    setProfileError(null);
    updateMutation.mutate({ id: profile.id, payload: { is_active: false } });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage account information, family profiles, and your health-data export.</p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-gray-500">Full name</dt><dd className="mt-1 font-medium text-gray-900">{user?.full_name || "—"}</dd></div>
            <div><dt className="text-sm text-gray-500">Email address</dt><dd className="mt-1 font-medium text-gray-900">{user?.email || "—"}</dd></div>
          </dl>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-semibold text-gray-900">Family health profiles</h2><p className="mt-1 text-sm text-gray-500">Each profile keeps its reports, medicines, documents, and notes separate.</p></div>
            <Button onClick={startCreate}>Add family member</Button>
          </div>
          {profileSuccess && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 fade-in" role="status">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{profileSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileSuccess(null)}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
              >
                Dismiss
              </button>
            </div>
          )}
          {profileError && <ErrorMessage message={profileError} />}
          <div className="divide-y divide-gray-100">
            {profiles.map((profile) => {
              const isActive = currentProfile?.id === profile.id;
              return (
                <div key={profile.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{profile.name}</span>
                      {profile.is_default && (
                        <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                          Me
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{profile.relationship_type}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>
                        <strong className="text-gray-700">DOB:</strong> {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : <span className="text-gray-400">Not provided</span>}
                      </span>
                      <span>
                        <strong className="text-gray-700">Blood Type:</strong> {profile.blood_type || <span className="text-gray-400">Not provided</span>}
                      </span>
                      <span>
                        <strong className="text-gray-700">Allergies:</strong> {profile.allergies || <span className="text-gray-400">Not provided</span>}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSwitchProfile(profile)}
                      >
                        Switch to this profile
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => startEdit(profile)}>
                      Edit
                    </Button>
                    {!profile.is_default && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={updateMutation.isPending}
                        onClick={() => void deactivateProfile(profile)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!profiles.length && <p className="py-4 text-sm text-gray-500">No active family profiles are available.</p>}
          </div>
          {formOpen && (
            <form onSubmit={submitProfile} className="space-y-4 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
              <h3 className="font-semibold text-gray-900">{editing ? "Edit family profile" : "Add family profile"}</h3>
              {formError && <ErrorMessage message={formError} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">Name
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-medium text-gray-700">Relationship
                  <input value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={100} required className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal" placeholder="Self, Parent, Child…" />
                </label>
                <label className="text-sm font-medium text-gray-700">Date of Birth (Optional)
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">Blood Type (Optional)
                  <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal text-sm">
                    <option value="">Not provided</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Allergies & Sensitivities (Optional)
                    <input value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={500} placeholder="e.g. Penicillin, Peanuts, Latex (leave blank if none provided)" className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal text-sm" />
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={isSaving} isLoading={isSaving}>{editing ? "Save changes" : "Create profile"}</Button></div>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-semibold text-gray-900">Export health data</h2><p className="mt-1 text-sm text-gray-500">Download the active profile's records as a JSON file.</p></div>
          <Button variant="secondary" onClick={() => void exportHealthData()} disabled={!currentProfile || exporting} isLoading={exporting}>Export active profile</Button>
          {exportError && <ErrorMessage message={exportError} />}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">Reminders and notifications</h2>
          <p className="mt-1 text-sm text-amber-900/80">This MVP does not yet send scheduled SMS or email reminders. Reminder preferences are not stored, so this page only shows features the backend currently supports.</p>
        </section>
      </div>
    </DashboardLayout>
  );
}
