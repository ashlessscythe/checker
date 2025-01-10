// app/layout.tsx
"use client";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/hooks/authContext";
import { DbProvider } from "@/components/providers/db-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <AuthProvider>
          <DbProvider>{children}</DbProvider>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
