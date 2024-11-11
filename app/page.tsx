// app/page.tsx
"use client";
import { useMemo, useState, Suspense } from "react";
import CheckInOutForm from "@/components/checkinoutform";
import { AuthModal } from "@/components/authmodal";
import { useAuth, AuthProvider } from "@/hooks/authContext";
import Header from "@/components/header";
import { Switch } from "@/components/ui/Switch";
import ToggleSection from "@/components/toggle-section";
import { lazyLoad } from "@/utils/lazyLoader";

// Lazy load the components
const AdvancedChecklist = lazyLoad("adv-checklist");
const Checklist = lazyLoad("checklist");
const AdminPage = lazyLoad("adminpage");
const BackupPage = lazyLoad("backuppage");
const CheckInsTable = lazyLoad("checkinstable");

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
    <div className="container mx-auto p-4">
      <Header setIsAuthModalOpen={setIsAuthModalOpen} />

      <div className="container mx-auto p-4">
        <CheckInOutForm shouldFocus={shouldFocusCheckInOut} />
      </div>

      {/* Show sections if user is either authorized or admin */}
      {(isAuthorized || isAdmin) && (
        <div className="space-y-4 mt-4">
          {/* Checklist and History visible to both authorized users and admins */}
          {canViewChecklist && (
            <>
              <ToggleSection
                title="Show FireDrill Checklist"
                isOpen={showChecklist}
                onToggle={() => setShowChecklist(!showChecklist)}
              />

              {showChecklist && (
                <div className="ml-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="font-semibold">
                      Show Advanced Checklist
                    </span>
                    <Switch isChecked={isAdvanced} onChange={setIsAdvanced} />
                  </div>
                  {isAdvanced ? <AdvancedChecklist /> : <Checklist />}
                </div>
              )}

              <ToggleSection
                title="Show Checkins History"
                isOpen={showCheckins}
                onToggle={() => setShowCheckins(!showCheckins)}
              />

              {showCheckins && (
                <div className="ml-4">
                  <CheckInsTable />
                </div>
              )}
            </>
          )}

          {/* Admin-only sections */}
          {isAdmin && (
            <>
              <ToggleSection
                title="Show Admin Page"
                isOpen={showAdminPage}
                onToggle={() => setShowAdminPage(!showAdminPage)}
              />
              {showAdminPage && (
                <div className="ml-4">
                  <Suspense fallback={<div>Loading admin page...</div>}>
                    <AdminPage />
                  </Suspense>
                </div>
              )}

              <ToggleSection
                title="Show Backup & Archive"
                isOpen={showBackupPage}
                onToggle={() => setShowBackupPage(!showBackupPage)}
              />
              {showBackupPage && (
                <div className="ml-4">
                  <Suspense fallback={<div>Loading backup page...</div>}>
                    <BackupPage />
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
