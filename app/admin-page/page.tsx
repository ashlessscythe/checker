// app/admin-page/page.tsx
"use client";

import React, { useState } from "react";
import AdminPage from "@/components/adminpage";
import BackupPage from "@/components/backuppage";
import VisitorAdmin from "@/components/visitoradmin";
import FireDrillAdmin from "../../components/firedrill-admin";
import NotAuthorizedPage from "@/components/notauthorizedpage";
import { AuthProvider, useAuth } from "@/hooks/authContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast, { Toaster } from "react-hot-toast";

type AdminTab = "users" | "backups" | "visitors" | "email" | "firedrill";

function AdminContent() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!isAdmin) {
    return <NotAuthorizedPage />;
  }

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      toast.error("Please enter a recipient email.");
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch("/api/admin/send-generic-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipientEmail,
          fromKey: "default",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message =
          errorData?.error || `Failed to send email (status ${res.status})`;
        toast.error(message);
        return;
      }

      toast.success("Email sent successfully.");
      setRecipientEmail("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 dark:bg-gray-900">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-6xl rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex flex-col items-start justify-between gap-2 sm:mb-6 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Admin Panel
          </h1>
          <Button
            type="button"
            variant="outline"
            className="text-sm"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Back to Kiosk
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === "users"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("backups")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === "backups"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Backups
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("visitors")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === "visitors"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Visitors
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === "email"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("firedrill")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === "firedrill"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            FireDrill
          </button>
        </div>

        {activeTab === "users" && (
          <div className="-mx-4 -mb-4 sm:mx-0 sm:mb-0">
            <AdminPage />
          </div>
        )}

        {activeTab === "backups" && (
          <div className="-mx-4 -mb-4 sm:mx-0 sm:mb-0">
            <BackupPage />
          </div>
        )}

        {activeTab === "visitors" && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
            <VisitorAdmin />
          </div>
        )}

        {activeTab === "email" && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              Send Generic Email
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Sends a simple test notification email using the configured
              Resend sender. We will expand templates and options later.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Send From
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  value="default"
                  disabled
                >
                  <option value="default">Default sender (RESEND_FROM_EMAIL)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Uses the `RESEND_FROM_EMAIL` configured on the server.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSending || !recipientEmail}
                  className="w-full sm:w-auto"
                >
                  {isSending ? "Sending..." : "Send Generic Email"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "firedrill" && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
            <FireDrillAdmin />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPageRoute() {
  return (
    <AuthProvider>
      <AdminContent />
    </AuthProvider>
  );
}

