import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { documentsApi, type DocumentResponse } from "@/api/documents";
import { useProfile } from "@/hooks/useProfile";
import type { ApiError } from "@/api/client";

const DOCUMENT_TYPES = ["Lab result", "Prescription", "Imaging", "Discharge summary", "Insurance", "Other"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: documents = [], isLoading, isError, error } = useQuery({
    queryKey: ["documents", profileId],
    queryFn: () => (profileId ? documentsApi.getDocuments(profileId) : []),
    enabled: !!profileId,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => {
      if (!profileId) throw new Error("Select a health profile first.");
      return documentsApi.deleteDocument(documentId, profileId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", profileId] }),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!profileId || !file) throw new Error("Choose a file and an active profile first.");
      return documentsApi.uploadDocument(profileId, file, title.trim(), documentType, notes);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", profileId] });
      setFormOpen(false);
      setTitle("");
      setDocumentType(DOCUMENT_TYPES[0]);
      setNotes("");
      setFile(null);
      setFormError(null);
    },
    onError: (err) => setFormError((err as unknown as ApiError)?.detail || (err as Error).message || "Could not upload this document."),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("Add a title for this document.");
    if (!file) return setFormError("Choose a PDF or image to upload.");
    if (file.size > MAX_FILE_BYTES) return setFormError("The file must be 10 MB or smaller.");
    uploadMutation.mutate();
  };

  const handleDownload = async (doc: DocumentResponse) => {
    if (!profileId) return;
    setDownloadError(null);
    setDownloadingId(doc.id);
    try {
      await documentsApi.downloadDocument(profileId, doc.id, doc.filename);
    } catch (err) {
      setDownloadError((err as unknown as ApiError)?.detail || "Could not download this document.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-700">{currentProfile?.name ?? "Health profile"}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Health Documents</h1>
            <p className="mt-1 text-sm text-gray-500">Keep prescriptions, imaging, lab files, and other records together.</p>
          </div>
          <Button onClick={() => { setFormError(null); setFormOpen((open) => !open); }} disabled={!profileId}>
            {formOpen ? "Cancel" : "Add document"}
          </Button>
        </header>

        {formOpen && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Upload a health document</h2>
            {formError && <ErrorMessage message={formError} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Document title
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" placeholder="e.g. Eye prescription" />
              </label>
              <label className="text-sm font-medium text-gray-700">Type
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal">
                  {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">File <span className="font-normal text-gray-500">PDF, JPG, or PNG up to 10 MB</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required className="mt-1.5 block w-full rounded-xl border border-gray-300 p-2 text-sm" />
            </label>
            {file && <p className="text-xs text-gray-500">Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>}
            <label className="block text-sm font-medium text-gray-700">Notes <span className="font-normal text-gray-400">(optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" placeholder="Add a brief note about this file" />
            </label>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={uploadMutation.isPending} disabled={uploadMutation.isPending || !profileId}>Upload document</Button>
            </div>
          </form>
        )}

        {downloadError && <ErrorMessage message={downloadError} />}
        {deleteMutation.isError && <ErrorMessage message={(deleteMutation.error as unknown as ApiError)?.detail || "Could not delete this document."} />}
        {isError && <ErrorMessage message={(error as unknown as ApiError)?.detail || "Could not load documents."} />}
        {isLoading ? <LoadingSpinner /> : documents.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((doc) => (
              <article key={doc.id} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{doc.document_type}</span>
                  <h2 className="mt-2 truncate font-semibold text-gray-900">{doc.title}</h2>
                  <p className="mt-1 break-all text-xs text-gray-500">{doc.filename}</p>
                  <p className="mt-2 text-xs text-gray-400">{(doc.file_size / 1024 / 1024).toFixed(2)} MB · {new Date(doc.created_at).toLocaleDateString()}</p>
                  {doc.notes && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{doc.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" disabled={downloadingId === doc.id} onClick={() => void handleDownload(doc)}>
                    {downloadingId === doc.id ? "Preparing…" : "Download"}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={deleteMutation.isPending} onClick={() => {
                    if (window.confirm(`Delete “${doc.title}” from this profile?`)) deleteMutation.mutate(doc.id);
                  }}>Delete</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="font-semibold text-gray-900">No documents for this profile yet</h2>
            <p className="mt-1 text-sm text-gray-500">Upload a prescription, imaging file, or another health record to get started.</p>
            {!formOpen && <Button className="mt-4" onClick={() => setFormOpen(true)} disabled={!profileId}>Add first document</Button>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
