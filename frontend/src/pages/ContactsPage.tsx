import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { contactsApi } from "@/api/contacts";
import { useProfile } from "@/hooks/useProfile";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function ContactsPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", profileId],
    queryFn: () => (profileId ? contactsApi.getContacts(profileId) : []),
    enabled: !!profileId,
  });

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency & Healthcare Directory</h1>
          <p className="mt-1 text-sm text-gray-500">Manage important health contacts and emergency numbers.</p>
        </div>
      </div>
      
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {contacts && contacts.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <li key={c.id} className="p-4 flex flex-col gap-1">
                  <div className="font-medium text-gray-900">{c.name} <span className="text-sm font-normal text-gray-500">({c.contact_type})</span></div>
                  <div className="text-sm text-gray-700">Phone: {c.phone}</div>
                  {c.email && <div className="text-sm text-gray-700">Email: {c.email}</div>}
                  {c.specialty && <div className="text-sm text-gray-700">Specialty: {c.specialty}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No contacts found.
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
