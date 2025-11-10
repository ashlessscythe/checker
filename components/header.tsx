"use client";
import Link from "next/link";
import { useAuth } from "../hooks/authContext";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { getAutoNavigateTimeout } from "@/lib/config";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  setIsAuthModalOpen: (isOpen: boolean) => void;
}

export default function Header({ setIsAuthModalOpen }: HeaderProps) {
  const { isAuthenticated, isAdmin, isAuthorized, user, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut();
    // You might want to redirect the user or update the UI after logout
    window.location.href = "/"; // Redirect to home after logout
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const toggleTheme = () => {
    const currentTheme = resolvedTheme || theme;
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  // reload page based on environment config
  useAutoNavigate("/", getAutoNavigateTimeout(), true);

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <button
          onClick={handleRefresh}
          className="text-2xl font-bold hover:text-gray-700 transition-colors cursor-pointer"
        >
          Check-In System
          <span className="block text-sm text-green-500">
            Press here to reload
          </span>
        </button>
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <span>Welcome, {user?.email}</span>
              {isAdmin && (
                <Link
                  href="/admin-page"
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Admin Panel
                </Link>
              )}
              {isAuthorized && (
                <Link
                  href="/checklist"
                  className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
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
            </>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-gray-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
            >
              Log In
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            {mounted ? (
              (resolvedTheme || theme) === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>
    </>
  );
}
