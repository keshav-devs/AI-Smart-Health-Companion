/**
 * Dashboard layout — top nav + sidebar (desktop) / hamburger (mobile).
 * Only shows working navigation items.
 */

import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Logo } from "@/components/ui/Logo";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { profiles, currentProfile, setCurrentProfile } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isDashboardActive = location.pathname === "/dashboard";
  const isTrendsActive = location.pathname === "/reports/trends";
  const isReportsActive =
    location.pathname.startsWith("/reports") && !isTrendsActive;
  const isMedicinesActive = location.pathname.startsWith("/medicines");
  const isDocumentsActive = location.pathname.startsWith("/documents");
  const isJournalActive = location.pathname.startsWith("/journal");
  const isDoctorQuestionsActive = location.pathname.startsWith("/doctor-questions");
  const isContactsActive = location.pathname.startsWith("/contacts");
  const isSettingsActive = location.pathname.startsWith("/settings");

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          {/* Left: logo + hamburger */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <Logo size="sm" />
          </div>

          {/* Right: user pill */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            {profiles.length > 0 && (
              <select
                value={currentProfile?.id || ""}
                onChange={(e) => {
                  const p = profiles.find(x => x.id === e.target.value);
                  if (p) setCurrentProfile(p);
                }}
                className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 py-1 pl-2 pr-8 ml-2"
                aria-label="Select Family Profile"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_default ? "(Me)" : ""}
                  </option>
                ))}
              </select>
            )}
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* ── Sidebar (desktop) ────────────────────────────────── */}
        <aside className="hidden lg:block w-60 flex-shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-4rem)]">
          <nav className="px-3 py-6 space-y-1" aria-label="Main navigation">
            <SidebarItem label="Dashboard" to="/dashboard" icon={DashboardIcon} active={isDashboardActive} />
            <SidebarItem label="Reports" to="/reports" icon={ReportsIcon} active={isReportsActive} />
            <SidebarItem label="Trends & History" to="/reports/trends" icon={TrendsIcon} active={isTrendsActive} />
            <SidebarItem label="Medicines" to="/medicines" icon={MedicinesIcon} active={isMedicinesActive} />
            <SidebarItem label="Documents" to="/documents" icon={ReportsIcon} active={isDocumentsActive} />
            <SidebarItem label="Journal" to="/journal" icon={ReportsIcon} active={isJournalActive} />
            <SidebarItem label="Doctor Qs" to="/doctor-questions" icon={AppointmentsIcon} active={isDoctorQuestionsActive} />
            <SidebarItem label="Contacts" to="/contacts" icon={AppointmentsIcon} active={isContactsActive} />
            <SidebarItem label="Settings" to="/settings" icon={SettingsIcon} active={isSettingsActive} />
          </nav>
        </aside>

        {/* ── Mobile menu overlay ──────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 slide-up">
              <div className="px-4 py-5 border-b border-gray-100 flex items-center justify-between">
                <Logo size="sm" />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="px-3 py-4 space-y-1" aria-label="Mobile navigation">
                <SidebarItem
                  label="Dashboard"
                  to="/dashboard"
                  icon={DashboardIcon}
                  active={isDashboardActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Reports"
                  to="/reports"
                  icon={ReportsIcon}
                  active={isReportsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Trends & History"
                  to="/reports/trends"
                  icon={TrendsIcon}
                  active={isTrendsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Medicines"
                  to="/medicines"
                  icon={MedicinesIcon}
                  active={isMedicinesActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Documents"
                  to="/documents"
                  icon={ReportsIcon}
                  active={isDocumentsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Journal"
                  to="/journal"
                  icon={ReportsIcon}
                  active={isJournalActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Doctor Qs"
                  to="/doctor-questions"
                  icon={AppointmentsIcon}
                  active={isDoctorQuestionsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Contacts"
                  to="/contacts"
                  icon={AppointmentsIcon}
                  active={isContactsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <SidebarItem
                  label="Settings"
                  to="/settings"
                  icon={SettingsIcon}
                  active={isSettingsActive}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </nav>
            </div>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────── */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Sidebar item ──────────────────────────────────────────────────── */

interface SidebarItemProps {
  label: string;
  icon: React.FC<{ className?: string }>;
  to?: string;
  active?: boolean;
  unavailable?: boolean;
  onClick?: () => void;
}

function SidebarItem({ label, icon: Icon, to, active, unavailable, onClick }: SidebarItemProps) {
  if (unavailable) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 cursor-default select-none">
        <Icon className="w-5 h-5" />
        <span className="text-sm">{label}</span>
        <span className="ml-auto text-[10px] font-medium bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
          Soon
        </span>
      </div>
    );
  }

  const content = (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-colors
        ${active
          ? "bg-primary-50 text-primary-700 font-medium"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm">{label}</span>
    </div>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

/* ── Icon components ───────────────────────────────────────────────── */

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  );
}

function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TrendsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}


function MedicinesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M19.428 15.428a2 2 0 00-2.857 0l-4.57 4.571a2 2 0 102.856 2.857l4.571-4.571a2 2 0 000-2.857zM7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function AppointmentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
