// app/page.tsx
"use client";
import { useMemo, useState, lazy, Suspense } from "react";
import CheckInOutForm from "@/components/checkinoutform";
import { AuthModal } from "@/components/authmodal";
import { useAuth, AuthProvider } from "@/hooks/authContext";
import Header from "@/components/header";
import { Switch } from "@/components/ui/Switch";
import { lazyLoad } from "@/utils/lazyLoader";

// Lazy load the components
const AdvancedChecklist = lazyLoad('adv-checklist')
const Checklist = lazyLoad('checklist')
const AdminPage = lazyLoad('adminpage')

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { isAuthenticated, isAdmin, isAuthorized } = useAuth();

  const shouldFocusCheckInOut = useMemo(() => {
    return !isAuthModalOpen && !isAuthenticated;
  }, [isAuthModalOpen, isAuthenticated]);

  return (
    <div className="container mx-auto p-4">
      <Header setIsAuthModalOpen={setIsAuthModalOpen} />

      <div className="container mx-auto p-4">
        <CheckInOutForm shouldFocus={shouldFocusCheckInOut} />
      </div>

      {/* Only render if the user is authenticated or is an admin */}
      {isAuthenticated || isAdmin ? (
        <>
          {/* Switch Toggle for Regular vs Advanced Checklist */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="font-semibold">Show Advanced Checklist</span>
            <Switch isChecked={isAdvanced} onChange={setIsAdvanced} />
          </div>

          {/* Conditionally Render Checklist based on Toggle */}
          {isAdvanced ? <AdvancedChecklist /> : <Checklist />}

          {/* Render Admin Page only if the user is an admin, using Suspense */}
          {isAdmin && (
            <Suspense fallback={<div>Loading admin page...</div>}>
              <AdminPage />
            </Suspense>
          )}
        </>
      ) : (
        <></>
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