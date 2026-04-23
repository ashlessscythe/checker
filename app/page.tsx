// app/page.tsx
"use client";
import React, { useMemo, useState, Suspense } from "react";
import CheckInOutForm from "@/components/checkinoutform";
import { AuthModal } from "@/components/authmodal";
import { useAuth, AuthProvider } from "@/hooks/authContext";
import Header from "@/components/header";
import { Switch } from "@/components/ui/Switch";
import ToggleSection from "@/components/toggle-section";
import VisitorPrecheckEmailPrompt from "@/components/visitor-precheck-email-prompt";
import VendorKioskModal from "@/components/vendor-kiosk-modal";
import Screensaver from "@/components/screensaver";
import { lazyLoad } from "@/utils/lazyLoader";
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
          <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center">
            <div className="flex min-w-0 flex-1 justify-center">
              <VisitorPrecheckEmailPrompt />
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <VendorKioskModal />
            </div>
          </div>
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
                  <Suspense fallback={<div>Loading checklist...</div>}>
                    {React.createElement(getChecklist(isAdvanced))}
                  </Suspense>
                  <div className="mt-4 flex flex-col gap-2 border-t border-sky-200/60 pt-4 dark:border-sky-700/50 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Show Advanced Checklist
                    </span>
                    <Switch isChecked={isAdvanced} onChange={setIsAdvanced} />
                  </div>
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
