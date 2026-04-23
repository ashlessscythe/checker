"use client";

import { useMemo, useState } from "react";
import { db } from "@/lib/instantdb";
import { id, tx } from "@instantdb/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

type ReasonRow = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type VendorRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: number;
  reasons?: ReasonRow[];
};

export default function VendorAdminSection() {
  const { data, isLoading, error } = db.useQuery({
    vendors: {
      $: {},
      reasons: {},
    },
  });

  const vendors = useMemo(() => {
    const list = (data?.vendors || []) as VendorRow[];
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [data?.vendors]);

  const [newVendorName, setNewVendorName] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);

  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newVendorName.trim();
    if (!name) {
      toast.error("Company name is required.");
      return;
    }
    setAddingVendor(true);
    try {
      const maxOrder = vendors.reduce((m, v) => Math.max(m, v.sortOrder ?? 0), 0);
      const now = Date.now();
      const vid = id();
      await db.transact([
        tx.vendors[vid].update({
          name,
          sortOrder: maxOrder + 1,
          isActive: true,
          createdAt: now,
        }),
      ]);
      toast.success("Vendor company added.");
      setNewVendorName("");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to add vendor.");
    } finally {
      setAddingVendor(false);
    }
  };

  const toggleVendor = async (v: VendorRow) => {
    try {
      await db.transact([
        tx.vendors[v.id].update({ isActive: !v.isActive }),
      ]);
      toast.success(v.isActive ? "Vendor disabled." : "Vendor enabled.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const deleteVendor = async (v: VendorRow) => {
    if (
      !confirm(
        `Delete vendor "${v.name}" and all of its visit reasons? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const reasons = v.reasons || [];
      const ops = reasons.map((r) => tx.vendorReasons[r.id].delete());
      ops.push(tx.vendors[v.id].delete());
      await db.transact(ops);
      toast.success("Vendor removed.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const addReason = async (vendorId: string) => {
    const label = (reasonDrafts[vendorId] || "").trim();
    if (!label) {
      toast.error("Enter a reason label.");
      return;
    }
    const v = vendors.find((x) => x.id === vendorId);
    const maxR = (v?.reasons || []).reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);
    const now = Date.now();
    const rid = id();
    try {
      await db.transact([
        tx.vendorReasons[rid]
          .update({
            label,
            sortOrder: maxR + 1,
            isActive: true,
            createdAt: now,
          })
          .link({ vendor: vendorId }),
      ]);
      toast.success("Reason added.");
      setReasonDrafts((d) => ({ ...d, [vendorId]: "" }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add reason.");
    }
  };

  const toggleReason = async (r: ReasonRow, active: boolean) => {
    try {
      await db.transact([tx.vendorReasons[r.id].update({ isActive: !active })]);
      toast.success(active ? "Reason disabled." : "Reason enabled.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const deleteReason = async (r: ReasonRow) => {
    if (!confirm("Delete this reason?")) return;
    try {
      await db.transact([tx.vendorReasons[r.id].delete()]);
      toast.success("Reason removed.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">Loading vendors…</p>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600">Error: {error.message}</p>;
  }

  return (
    <>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        Companies appear in the lobby <strong>Vendor check-in / checkout</strong>{" "}
        dropdown. Each company has its own list of reasons; the kiosk also offers an{" "}
        <strong>Other</strong> choice for reasons without storing it here.
      </p>

      <form
        onSubmit={addVendor}
        className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            New vendor company
          </label>
          <Input
            value={newVendorName}
            onChange={(e) => setNewVendorName(e.target.value)}
            placeholder="e.g. ACME HVAC Services"
          />
        </div>
        <Button type="submit" disabled={addingVendor} size="sm">
          {addingVendor ? "Adding…" : "Add company"}
        </Button>
      </form>

      {vendors.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No vendor companies yet. Add one above so vendors can check in from the main
          page.
        </p>
      ) : (
        <ul className="space-y-4">
          {vendors.map((v) => {
            const reasons = [...(v.reasons || [])].sort(
              (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
            );
            return (
              <li
                key={v.id}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {v.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      sort {v.sortOrder ?? 0} • {v.isActive ? "active" : "inactive"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVendor(v)}
                    >
                      {v.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteVendor(v)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Reasons for visiting (this company)
                  </h3>
                  {reasons.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                      No reasons yet. Visitors can still pick &quot;Other&quot; at the kiosk.
                    </p>
                  ) : (
                    <ul className="mb-3 space-y-2">
                      {reasons.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 px-2 py-2 text-sm dark:border-gray-700"
                        >
                          <span className="text-gray-900 dark:text-gray-100">
                            {r.label}{" "}
                            <span className="text-xs text-gray-500">
                              ({r.isActive ? "active" : "inactive"})
                            </span>
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleReason(r, r.isActive)}
                            >
                              {r.isActive ? "Off" : "On"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteReason(r)}
                            >
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Input
                      className="sm:max-w-xs"
                      placeholder="New reason (e.g. Scheduled maintenance)"
                      value={reasonDrafts[v.id] ?? ""}
                      onChange={(e) =>
                        setReasonDrafts((d) => ({ ...d, [v.id]: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addReason(v.id)}
                    >
                      Add reason
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
