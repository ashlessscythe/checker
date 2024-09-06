// app/page.tsx
"use client";
import { useMemo, useState } from "react";
import CheckInOutForm from "../components/checkinoutform";
import { AuthModal } from "../components/authmodal";
import { useAuth, AuthProvider } from "../hooks/authContext";
import Header from "../components/header";
import Checklist from "../components/checklist";
import AdminPage from "../components/adminpage";

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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

      {isAuthenticated && (isAuthorized || isAdmin) && <Checklist />}
      {isAuthenticated && isAdmin && <AdminPage />}

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
