import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { contactsApi, type ContactBase, type ContactResponse } from "@/api/contacts";
import { useProfile } from "@/hooks/useProfile";
import type { ApiError } from "@/api/client";

const CONTACT_TYPES = ["emergency", "doctor", "specialist", "other"];
const EMPTY_FORM: ContactBase = { contact_type: "doctor", name: "", phone: "", email: "", address: "", contact_relationship: "", specialty: "", notes: "" };

export function ContactsPage() {
  const queryClient = useQueryClient();
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactResponse | null>(null);
  const [form, setForm] = useState<ContactBase>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: contacts = [], isLoading, isError, error } = useQuery({
    queryKey: ["contacts", profileId],
    queryFn: () => (profileId ? contactsApi.getContacts(profileId) : []),
    enabled: !!profileId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts", profileId] });
  const createMutation = useMutation({
    mutationFn: (payload: ContactBase) => {
      if (!profileId) throw new Error("Select a health profile first.");
      return contactsApi.createContact({ ...payload, profile_id: profileId });
    },
    onSuccess: () => { void refresh(); closeForm(); },
    onError: (err) => setFormError((err as unknown as ApiError)?.detail || "Could not save this contact."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContactBase }) => contactsApi.updateContact(id, payload),
    onSuccess: () => { void refresh(); closeForm(); },
    onError: (err) => setFormError((err as unknown as ApiError)?.detail || "Could not update this contact."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.deleteContact(id),
    onSuccess: () => { void refresh(); },
  });

  function closeForm() { setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(null); }
  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setFormOpen(true); }
  function openEdit(contact: ContactResponse) {
    setEditing(contact);
    setForm({ contact_type: contact.contact_type, name: contact.name, phone: contact.phone, email: contact.email || "", address: contact.address || "", contact_relationship: contact.contact_relationship || "", specialty: contact.specialty || "", notes: contact.notes || "" });
    setFormError(null);
    setFormOpen(true);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const payload = { ...form, name: form.name.trim(), phone: form.phone.trim(), email: form.email?.trim() || undefined, address: form.address?.trim() || undefined, contact_relationship: form.contact_relationship?.trim() || undefined, specialty: form.specialty?.trim() || undefined, notes: form.notes?.trim() || undefined };
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-700">{currentProfile?.name ?? "Health profile"}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Care & Emergency Contacts</h1>
            <p className="mt-1 text-sm text-gray-500">Keep important care-team and emergency details available for this profile.</p>
          </div>
          <Button onClick={openAdd} disabled={!profileId}>Add contact</Button>
        </header>

        {formOpen && (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit contact" : "Add a contact"}</h2>
              <button type="button" onClick={closeForm} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
            </div>
            {formError && <ErrorMessage message={formError} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Contact type
                <select value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal">
                  {CONTACT_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={255} required className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-medium text-gray-700">Phone
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} required type="tel" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-medium text-gray-700">Email <span className="font-normal text-gray-400">(optional)</span>
                <input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} type="email" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-medium text-gray-700">Relationship <span className="font-normal text-gray-400">(optional)</span>
                <input value={form.contact_relationship || ""} onChange={(e) => setForm({ ...form, contact_relationship: e.target.value })} maxLength={100} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" placeholder="e.g. Parent, primary physician" />
              </label>
              <label className="text-sm font-medium text-gray-700">Specialty <span className="font-normal text-gray-400">(optional)</span>
                <input value={form.specialty || ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })} maxLength={100} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" placeholder="e.g. Cardiology" />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">Address <span className="font-normal text-gray-400">(optional)</span>
              <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Notes <span className="font-normal text-gray-400">(optional)</span>
              <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={2} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
            </label>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              <Button type="submit" isLoading={isSaving} disabled={isSaving || !profileId}>{editing ? "Save changes" : "Save contact"}</Button>
            </div>
          </form>
        )}

        {isError && <ErrorMessage message={(error as unknown as ApiError)?.detail || "Could not load contacts."} />}
        {deleteMutation.isError && <ErrorMessage message={(deleteMutation.error as unknown as ApiError)?.detail || "Could not delete this contact."} />}
        {isLoading ? <LoadingSpinner /> : contacts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {contacts.map((contact) => (
              <article key={contact.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium capitalize text-primary-700">{contact.contact_type}</span>
                    <h2 className="mt-2 font-semibold text-gray-900">{contact.name}</h2>
                    <a className="mt-1 block text-sm text-primary-700 hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a>
                    {contact.email && <a className="mt-1 block break-all text-sm text-gray-600 hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>}
                    {contact.specialty && <p className="mt-2 text-sm text-gray-600">{contact.specialty}</p>}
                    {contact.address && <p className="mt-1 text-sm text-gray-500">{contact.address}</p>}
                    {contact.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500">{contact.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(contact)}>Edit</Button>
                    <Button size="sm" variant="secondary" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete ${contact.name} from this profile?`)) deleteMutation.mutate(contact.id); }}>Delete</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="font-semibold text-gray-900">No contacts for this profile yet</h2>
            <p className="mt-1 text-sm text-gray-500">Add a trusted emergency contact or member of the care team.</p>
            {!formOpen && <Button className="mt-4" onClick={openAdd} disabled={!profileId}>Add first contact</Button>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
