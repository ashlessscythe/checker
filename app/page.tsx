// app/page.tsx
"use client";
import { useState } from 'react';
import CheckInOutForm from '../components/checkinoutform';
import { AuthModal } from '../components/authmodal';
import { useAuth, AuthProvider } from '../hooks/authContext';
import Header from '../components/header';
import Checklist from '../components/checklist';
import AdminPage from '../components/adminpage';

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isAuthenticated, isAdmin, isAuthorized } = useAuth();
  console.log(`isAuthenticated: ${isAuthenticated}, isAdmin: ${isAdmin}, isAuthorized: ${isAuthorized}`)

  return (
    <div className="container mx-auto p-4">
      <Header setIsAuthModalOpen={setIsAuthModalOpen} />

      <div className="container mx-auto p-4">
        <CheckInOutForm isAuthModalOpen={isAuthModalOpen} />
      </div>

      {isAuthenticated && isAdmin && <AdminPage />}
      {isAuthenticated && (isAuthorized || isAdmin) && <Checklist />}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
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