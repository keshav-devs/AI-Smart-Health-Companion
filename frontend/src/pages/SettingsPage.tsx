import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your account and app preferences.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Account Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-y-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-gray-500">Full Name</div>
              <div className="mt-1 text-gray-900 font-medium">{user?.full_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email Address</div>
              <div className="mt-1 text-gray-900 font-medium">{user?.email}</div>
            </div>
          </div>
        </div>
        
        <hr className="border-gray-100" />
        
        <div>
          <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mt-1">Configure how you want to be notified.</p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500" defaultChecked />
              <span className="text-sm text-gray-700">Email Notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500" defaultChecked />
              <span className="text-sm text-gray-700">In-App Notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">SMS Notifications</span>
            </label>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
