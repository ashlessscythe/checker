// app/page.tsx
"use client";
import { useMemo, useState, lazy, Suspense } from "react";
import CheckInOutForm from "@/components/checkinoutform";
import { AuthModal } from "@/components/authmodal";
import { useAuth, AuthProvider } from "@/hooks/authContext";
import Header from "@/components/header";
import { Switch } from "@/components/ui/Switch";
import ToggleSection from "@/components/toggle-section";
import { lazyLoad } from "@/utils/lazyLoader";

// Lazy load the components
const AdvancedChecklist = lazyLoad('adv-checklist')
const Checklist = lazyLoad('checklist')
const AdminPage = lazyLoad('adminpage')

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { isAuthenticated, isAdmin, isAuthorized } = useAuth();

  const [showChecklist, setShowChecklist] = useState(false)
  const [showAdminPage, setShowAdminPage] = useState(false)

  const shouldFocusCheckInOut = useMemo(() => {
    return !isAuthModalOpen && !isAuthenticated;
  }, [isAuthModalOpen, isAuthenticated]);

  return (
    <div className="container mx-auto p-4">
      <Header setIsAuthModalOpen={setIsAuthModalOpen} />

      <div className="container mx-auto p-4">
        <CheckInOutForm shouldFocus={shouldFocusCheckInOut} />
      </div>

     {/* Only render toggles if the user is authenticated or is an admin */}
      {(isAuthenticated || isAdmin) && (
        <div className="space-y-4 mt-4">
          <ToggleSection
            title="Show Checklist"
            isOpen={showChecklist}
            onToggle={() => setShowChecklist(!showChecklist)}
          />
          
          {showChecklist && (
            <div className="ml-4">
              <div className="flex items-center space-x-2 mb-4">
                <span className="font-semibold">Show Advanced Checklist</span>
                <Switch isChecked={isAdvanced} onChange={setIsAdvanced} />
              </div>
              {isAdvanced ? <AdvancedChecklist /> : <Checklist />}
            </div>
          )}

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      <AuthProvider>
        <HomeContent />
      </AuthProvider>
    </>
  );
}