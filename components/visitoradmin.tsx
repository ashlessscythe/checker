"use client";

import { useState } from "react";
import { db } from "@/lib/instantdb";
import { tx, id } from "@instantdb/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import toast from "react-hot-toast";

export default function VisitorAdmin() {
  const { data, isLoading, error } = db.useQuery({
    visitOptions: {
      $: {},
    },
  });

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<"who" | "why">("who");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const options = (data?.visitOptions || []) as Array<{
    id: string;
    label: string;
    category: string;
    sortOrder: number;
    isActive: boolean;
  }>;

  const whoOptions = options
    .filter((o) => o.category === "who")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const whyOptions = options
    .filter((o) => o.category === "why")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label is required.");
      return;
    }

    setIsSaving(true);
    try {
      const optionId = id();
      const now = Date.now();
      await db.transact([
        tx.visitOptions[optionId].update({
          label: label.trim(),
          category,
          sortOrder,
          isActive: true,
          createdAt: now,
        }),
      ]);
      toast.success("Visitor option added.");
      setLabel("");
      setSortOrder(0);
    } catch (err: any) {
      console.error("Failed to add visitOption", err);
      toast.error(err?.message || "Failed to add option.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (optionId: string, current: boolean) => {
    try {
      await db.transact([
        tx.visitOptions[optionId].update({ isActive: !current }),
      ]);
      toast.success("Updated option.");
    } catch (err: any) {
      console.error("Failed to update visitOption", err);
      toast.error(err?.message || "Failed to update option.");
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setIsSendingInvite(true);
    try {
      const res = await fetch("/api/visitor/precheck/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to send invite.");
        return;
      }
      toast.success("Pre-check invite sent.");
      setInviteEmail("");
    } catch (err: any) {
      console.error("Failed sending invite", err);
      toast.error(err?.message || "Failed to send invite.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (isLoading) {
    return <div>Loading visitor settings...</div>;
  }
  if (error) {
    return <div>Error loading visitor settings: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Send Visitor Pre-Check Invite
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Manually send a visitor pre-check email to any address. The visitor will
          complete their details and receive a code usable at the kiosk.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="visitor@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleSendInvite}
            disabled={isSendingInvite}
            className="w-full sm:w-auto"
          >
            {isSendingInvite ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Visitor Options (Who &amp; Why)
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Manage the dropdown options for who visitors are seeing and why they&apos;re
          visiting. These appear on the pre-check form.
        </p>

        <form onSubmit={handleAddOption} className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Front Desk, HR, Interview"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as "who" | "why")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="who">Who (host / whom)</SelectItem>
                <SelectItem value="why">Why (reason for visit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort Order
            </label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Option"}
            </Button>
          </div>
        </form>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Who (Host / Whom)
            </h3>
            {whoOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-2">
              {whoOptions.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      sort: {opt.sortOrder ?? 0} • {opt.isActive ? "active" : "inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(opt.id, opt.isActive)}
                  >
                    {opt.isActive ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Why (Reason)
            </h3>
            {whyOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-2">
              {whyOptions.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      sort: {opt.sortOrder ?? 0} • {opt.isActive ? "active" : "inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(opt.id, opt.isActive)}
                  >
                    {opt.isActive ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

