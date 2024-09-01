// page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db } from '../lib/instantdb';
import CheckInOutForm from '../components/checkinoutform';
import { AuthModal } from '../components/authmodal';
import Link from 'next/link';

export default function Home() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isLoading, user, error } = db.useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  // Query for user details including admin status
  const { data: userData } = db.useQuery({
    users: {
      $: user ? { where: { email: user.email } } : { limit: 0 },
    },
  });

  useEffect(() => {
    if (userData && userData.users && userData.users.length > 0) {
      setIsAdmin(userData.users[0].isAdmin || false);
      setIsAuth(userData.users[0].isAuth || false);
    } else {
      setIsAdmin(false);
      setIsAuth(false)
    }
  }, [userData]);

  const handleLogout = async () => {
    try {
      await db.auth.signOut();
      setIsAdmin(false);
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Check-In System</h1>
        {user ? (
          <div className="flex items-center space-x-4">
            <span>Welcome, {user.email}</span>
            {isAdmin && (
              <Link href="/admin-page" className="text-blue-500 hover:text-blue-700">
                Admin Panel
              </Link>
            )}
            <button 
              onClick={handleLogout}
              className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors" 
            >
              Log Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
          >
            Log In
          </button>
        )}
      </header>
      <CheckInOutForm isAuthModalOpen={isAuthModalOpen} isAuth={isAdmin || isAuth} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}