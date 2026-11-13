import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/api/documents";
import { useProfile } from "@/hooks/useProfile";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function DocumentsPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", profileId],
    queryFn: () => (profileId ? documentsApi.getDocuments(profileId) : []),
    enabled: !!profileId,
  });

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Documents Vault</h1>
          <p className="mt-1 text-sm text-gray-500">Securely store and manage health records, imaging, and bills.</p>
        </div>
      </div>
      
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {documents && documents.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <li key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{doc.title}</h3>
                    <p className="text-xs text-gray-500">{doc.document_type} • {doc.filename}</p>
                  </div>
                  <a
                    href={documentsApi.getDocumentDownloadUrl(doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No documents found.
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
