"use client";

import { useState } from "react";
import Link from "next/link";
import CheckInsTable from "../../components/checkinstable";

export default function CheckIns() {
  return (
    <div className="container mx-auto px-4 py-8">
      <CheckInsTable />
      <div className="mt-4">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Check In/Out
        </Link>
      </div>
    </div>
  );
}
