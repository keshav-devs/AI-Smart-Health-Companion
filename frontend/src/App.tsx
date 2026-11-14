/**
 * Root application component — routing and auth gating.
 */

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ReportsListPage } from "@/pages/ReportsListPage";
import { ReportUploadPage } from "@/pages/ReportUploadPage";
import { ReportDetailPage } from "@/pages/ReportDetailPage";
import { ReportTrendsPage } from "@/pages/ReportTrendsPage";
import { MedicinesPage } from "@/pages/MedicinesPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { JournalPage } from "@/pages/JournalPage";
import { DoctorQuestionsPage } from "@/pages/DoctorQuestionsPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { HealthChatPage } from "@/pages/HealthChatPage";
import { HealthHistoryPage } from "@/pages/HealthHistoryPage";
import { EmergencyPage } from "@/pages/EmergencyPage";
import { type ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
            <AppRoutes />
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Loading your session…" />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsListPage /></Protected>} />
      <Route path="/reports/trends" element={<Protected><ReportTrendsPage /></Protected>} />
      <Route path="/reports/upload" element={<Protected><ReportUploadPage /></Protected>} />
      <Route path="/reports/:reportId" element={<Protected><ReportDetailPage /></Protected>} />
      <Route path="/medicines" element={<Protected><MedicinesPage /></Protected>} />
      <Route path="/documents" element={<Protected><DocumentsPage /></Protected>} />
      <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
      <Route path="/doctor-questions" element={<Protected><DoctorQuestionsPage /></Protected>} />
      <Route path="/contacts" element={<Protected><ContactsPage /></Protected>} />
      <Route path="/health-chat" element={<Protected><HealthChatPage /></Protected>} />
      <Route path="/health-history" element={<Protected><HealthHistoryPage /></Protected>} />
      <Route path="/emergency" element={<Protected><EmergencyPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/** Redirect authenticated users away from auth pages. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Redirect unauthenticated users to login. */
function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
