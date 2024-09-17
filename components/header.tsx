"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/authContext";

interface HeaderProps {
  setIsAuthModalOpen: (isOpen: boolean) => void;
}

export default function Header({ setIsAuthModalOpen }: HeaderProps) {
  const { isAuthenticated, isAdmin, isAuthorized, user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    // You might want to redirect the user or update the UI after logout
    window.location.href = "/"; // Redirect to home after logout
  };

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Check-In System</h1>
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <span>Welcome, {user?.email}</span>
            {isAdmin && (
              <Link
                href="/admin-page"
                className="text-blue-500 hover:text-blue-700"
              >
                Admin Panel
              </Link>
            )}
            {isAuthorized && (
              <Link
                href="/checklist"
                className="text-green-500 hover:text-green-700"
              >
                Checklist
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
            className="bg-gray-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
          >
            Log In
          </button>
        )}
      </header>
    </>
  );
}
