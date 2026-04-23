"use client";

import React from "react";
import ToggleSection from "@/components/toggle-section";

export default function AdminCollapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-sky-200/80 bg-gray-50 shadow-sm dark:border-sky-800/70 dark:bg-gray-900">
      <div className="p-1">
        <ToggleSection title={title} isOpen={open} onToggle={onToggle} />
      </div>
      {open ? (
        <div className="border-t-2 border-sky-200/80 px-4 pb-4 pt-3 dark:border-sky-800/70 sm:px-6 sm:pb-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}
