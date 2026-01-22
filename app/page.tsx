// app/page.tsx
"use client";
import React, { useMemo, useState, Suspense } from "react";
import CheckInOutForm from "@/components/checkinoutform";
import { AuthModal } from "@/components/authmodal";
import { useAuth, AuthProvider } from "@/hooks/authContext";
import Header from "@/components/header";
import { Switch } from "@/components/ui/Switch";
import ToggleSection from "@/components/toggle-section";
import VisitorRegistration from "@/components/visitorcheck";
import Screensaver from "@/components/screensaver";
import { lazyLoad } from "@/utils/lazyLoader";

// Lazy load admin components together
const AdminPage = lazyLoad("adminpage", { withAutoNav: true });
const BackupPage = lazyLoad("backuppage");
const CheckInsTable = lazyLoad("checkinstable", {
  withAutoNav: true,
  path: "/",
  fullReload: true,
});

// Lazy load checklists conditionally
const getChecklist = (isAdvanced: boolean) =>
  lazyLoad(isAdvanced ? "adv-checklist" : "checklist", {
    withAutoNav: true,
    path: "/",
    fullReload: true,
  });

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { isAuthenticated, isAdmin, isAuthorized } = useAuth();

  const [showChecklist, setShowChecklist] = useState(false);
  const [showCheckins, setShowCheckins] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [showBackupPage, setShowBackupPage] = useState(false);

  const shouldFocusCheckInOut = useMemo(() => {
    return !isAuthModalOpen && !isAuthenticated;
  }, [isAuthModalOpen, isAuthenticated]);

  // User can see checklist and history if they're either authorized or an admin
  const canViewChecklist = isAuthorized || isAdmin;

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      <Header setIsAuthModalOpen={setIsAuthModalOpen} />

      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center space-y-4">
          <CheckInOutForm shouldFocus={shouldFocusCheckInOut} />
          <VisitorRegistration />
        </div>
      </div>

      {/* Show sections if user is either authorized or admin */}
      {(isAuthorized || isAdmin) && (
        <div className="mt-6 space-y-4">
          {/* Checklist and History visible to both authorized users and admins */}
          {canViewChecklist && (
            <>
              <ToggleSection
                title="Show FireDrill Checklist"
                isOpen={showChecklist}
                onToggle={() => setShowChecklist(!showChecklist)}
              />

              {showChecklist && (
                <div className="mt-3 rounded-lg border border-sky-200/70 bg-white/70 p-3 shadow-sm dark:border-sky-700/70 dark:bg-gray-800/50 sm:p-4 md:ml-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Show Advanced Checklist
                    </span>
                    <Switch isChecked={isAdvanced} onChange={setIsAdvanced} />
                  </div>
                  <Suspense fallback={<div>Loading checklist...</div>}>
                    {React.createElement(getChecklist(isAdvanced))}
                  </Suspense>
                </div>
              )}

              <ToggleSection
                title="Show Checkins History"
                isOpen={showCheckins}
                onToggle={() => setShowCheckins(!showCheckins)}
              />

              {showCheckins && (
                <div className="mt-3 rounded-lg border border-sky-200/70 bg-white/70 p-3 shadow-sm dark:border-sky-700/70 dark:bg-gray-800/50 sm:p-4 md:ml-4">
                  <Suspense fallback={<div>Loading check-ins history...</div>}>
                    <CheckInsTable />
                  </Suspense>
                </div>
              )}
            </>
          )}

          {/* Admin-only sections */}
          {isAdmin && (
            <>
              <Suspense fallback={<div>Loading admin features...</div>}>
                <ToggleSection
                  title="Show Admin Page"
                  isOpen={showAdminPage}
                  onToggle={() => setShowAdminPage(!showAdminPage)}
                />
                {showAdminPage && (
                  <div className="mt-3 rounded-lg border border-sky-200/70 bg-white/70 p-3 shadow-sm dark:border-sky-700/70 dark:bg-gray-800/50 sm:p-4 md:ml-4">
                    <AdminPage />
                  </div>
                )}

                <ToggleSection
                  title="Show Backup & Archive"
                  isOpen={showBackupPage}
                  onToggle={() => setShowBackupPage(!showBackupPage)}
                />
                {showBackupPage && (
                  <div className="mt-3 rounded-lg border border-sky-200/70 bg-white/70 p-3 shadow-sm dark:border-sky-700/70 dark:bg-gray-800/50 sm:p-4 md:ml-4">
                    <BackupPage />
                  </div>
                )}
              </Suspense>
            </>
          )}
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        shouldFocus={isAuthModalOpen}
      />
      <Screensaver inactivityTimeout={30000} isAuthenticated={isAuthenticated} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
