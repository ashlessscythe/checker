// components/AdminPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { id, tx } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import Papa from "papaparse";
import { useAutoNavigate } from "../hooks/useAutoNavigate";
import { useAuth } from "../hooks/authContext";
import { useDebounce } from "../hooks/useDebounce";
import AdminCollapsible from "./admin-collapsible";
import { USER_IMPORT_CSV_HEADERS } from "@/lib/user-import-csv-columns";
import {
  generateValidBarcode,
  verifyBarcode,
} from "@/utils/barcodeVerification";

type EditField = "name" | "email" | "barcode" | "department";

type TriState = "any" | "yes" | "no";
type SortKey = "email" | "name" | "barcode";

function matchesSearch(
  user: {
    name?: string;
    email?: string;
    barcode?: string;
  },
  q: string
) {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  return [user.name, user.email, user.barcode].some(
    (v) => typeof v === "string" && v.toLowerCase().includes(n)
  );
}

function filterToggleClass(active: boolean) {
  return active
    ? "bg-blue-600 text-white dark:bg-blue-500"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600";
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const USERS_CSV_SECTION_STORAGE_KEY = "checker-admin-users-csv-section";
const USERS_LIST_SECTION_STORAGE_KEY = "checker-admin-users-list-section";
const USERS_ADD_SECTION_STORAGE_KEY = "checker-admin-users-add-section";

type ImportApiResult = {
  ok?: boolean;
  dryRun?: boolean;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  departmentsCreatedCount?: number;
  rowErrors?: { line: number; message: string }[];
  error?: string;
};

export default function AdminPage() {
  const { data, isLoading, error } = db.useQuery({
    users: {},
    departments: {},
  });
  const { user: authUser } = useAuth();
  const [editField, setEditField] = useState<{
    userId: string;
    field: EditField;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 280);
  const [adminFilter, setAdminFilter] = useState<TriState>("any");
  const [authFilter, setAuthFilter] = useState<TriState>("any");
  const [sortKey, setSortKey] = useState<SortKey>("email");

  const [csvSectionOpen, setCsvSectionOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importCsvText, setImportCsvText] = useState<string | null>(null);
  const [importFileLabel, setImportFileLabel] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importGenerateBarcode, setImportGenerateBarcode] = useState(true);
  const [importCreateDept, setImportCreateDept] = useState(false);
  const [lastImportPreview, setLastImportPreview] =
    useState<ImportApiResult | null>(null);

  const [usersListOpen, setUsersListOpen] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [creatingDept, setCreatingDept] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserBarcode, setNewUserBarcode] = useState("");
  const [newUserDeptId, setNewUserDeptId] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deptListEditId, setDeptListEditId] = useState<string | null>(null);
  const [deptListDraftName, setDeptListDraftName] = useState("");
  const [deptListDraftCode, setDeptListDraftCode] = useState("");
  const [savingDeptList, setSavingDeptList] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USERS_CSV_SECTION_STORAGE_KEY);
      if (raw === "true") setCsvSectionOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USERS_LIST_SECTION_STORAGE_KEY);
      if (raw === "false") setUsersListOpen(false);
      else setUsersListOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(USERS_ADD_SECTION_STORAGE_KEY) === "true") {
        setAddSectionOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCsvSection = () => {
    setCsvSectionOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(
          USERS_CSV_SECTION_STORAGE_KEY,
          next ? "true" : "false"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleUsersListSection = () => {
    setUsersListOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(
          USERS_LIST_SECTION_STORAGE_KEY,
          next ? "true" : "false"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleAddSection = () => {
    setAddSectionOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(
          USERS_ADD_SECTION_STORAGE_KEY,
          next ? "true" : "false"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useAutoNavigate("/", 300000);

  const allUsers = data?.users ?? [];

  const displayUsers = useMemo(() => {
    let list = [...allUsers];

    list = list.filter((u) => matchesSearch(u, debouncedSearch));

    if (adminFilter === "yes") list = list.filter((u) => Boolean(u.isAdmin));
    if (adminFilter === "no") list = list.filter((u) => !u.isAdmin);

    if (authFilter === "yes") list = list.filter((u) => Boolean(u.isAuth));
    if (authFilter === "no") list = list.filter((u) => !u.isAuth);

    const sortField = (u: (typeof list)[0]) => {
      if (sortKey === "email") return u.email ?? "";
      if (sortKey === "name") return u.name ?? "";
      return u.barcode ?? "";
    };
    list.sort((a, b) =>
      sortField(a).localeCompare(sortField(b), undefined, {
        sensitivity: "base",
      })
    );

    return list;
  }, [allUsers, debouncedSearch, adminFilter, authFilter, sortKey]);

  const currentAppUserId = authUser?.id ?? null;

  const deptNameByUserDeptId = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data?.departments ?? []) {
      map.set(d.id, d.name ?? "");
    }
    return map;
  }, [data?.departments]);

  const departmentsSorted = useMemo(() => {
    return [...(data?.departments ?? [])].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      })
    );
  }, [data?.departments]);

  const exportUsersCsv = () => {
    try {
      const sorted = [...allUsers].sort((a, b) =>
        (a.email ?? "").localeCompare(b.email ?? "", undefined, {
          sensitivity: "base",
        })
      );
      const rows = sorted.map((u) => ({
        name: u.name ?? "",
        email: u.email ?? "",
        barcode: u.barcode ?? "",
        is_admin: u.isAdmin ? "true" : "false",
        department_name: deptNameByUserDeptId.get(u.deptId) ?? "",
      }));
      const csv = Papa.unparse(rows, {
        columns: [...USER_IMPORT_CSV_HEADERS],
        quotes: true,
        header: true,
      });
      const blob = new Blob([`\ufeff${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded.");
    } catch (e) {
      console.error(e);
      toast.error("Could not build CSV export.");
    }
  };

  const clearImportFile = () => {
    setImportCsvText(null);
    setImportFileLabel(null);
    setLastImportPreview(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const postUserImport = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json: ImportApiResult = {};
    try {
      json = (await res.json()) as ImportApiResult;
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new Error(json.error || `Import failed (${res.status})`);
    }
    return json;
  };

  const runImportDryRun = async () => {
    if (!importCsvText?.trim()) {
      toast.error("Choose a CSV file first (read in your browser).");
      return;
    }
    setImportBusy(true);
    setLastImportPreview(null);
    try {
      const result = await postUserImport({
        csvText: importCsvText,
        dryRun: true,
        overwrite: importOverwrite,
        generateBarcodeIfBlank: importGenerateBarcode,
        createDepartmentIfMissing: importCreateDept,
      });
      setLastImportPreview(result);
      toast.success("Preview ready — review counts and errors below.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const runImportApply = async () => {
    if (!importCsvText?.trim()) {
      toast.error("Choose a CSV file first.");
      return;
    }
    const ok = window.confirm(
      "Apply this import to the database? Existing users are only updated when Overwrite is on."
    );
    if (!ok) return;
    setImportBusy(true);
    try {
      const result = await postUserImport({
        csvText: importCsvText,
        dryRun: false,
        overwrite: importOverwrite,
        generateBarcodeIfBlank: importGenerateBarcode,
        createDepartmentIfMissing: importCreateDept,
      });
      setLastImportPreview(result);
      toast.success(
        `Import finished: created ${result.createdCount ?? 0}, updated ${result.updatedCount ?? 0}, skipped ${result.skippedCount ?? 0}.`
      );
      clearImportFile();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const beginEdit = (userId: string, field: EditField, current: string) => {
    setEditField({ userId, field });
    setDraft(current ?? "");
  };

  const cancelEdit = () => {
    setEditField(null);
    setDraft("");
  };

  const handleNameSave = async (userId: string) => {
    const name = draft.trim();
    if (!name) {
      toast.error("Name cannot be empty.");
      return;
    }
    try {
      await db.transact([tx.users[userId].update({ name })]);
      toast.success("Name updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update name.");
    }
  };

  const handleEmailSave = async (userId: string) => {
    const normalized = normalizeEmail(draft);
    if (!isValidEmail(normalized)) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      const { data: existing } = await db.queryOnce({
        users: {
          $: { where: { email: normalized } },
        },
      });
      if (existing?.users?.some((u) => u.id !== userId)) {
        toast.error("That email is already used by another user.");
        return;
      }
      await db.transact([tx.users[userId].update({ email: normalized })]);
      toast.success("Email updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update email.");
    }
  };

  const handleBarcodeSave = async (userId: string) => {
    const barcode = draft.trim();
    try {
      const { data: existing } = await db.queryOnce({
        users: {
          $: { where: { barcode } },
        },
      });
      if (
        barcode &&
        existing?.users?.some((u) => u.id !== userId)
      ) {
        toast.error("That kiosk barcode is already assigned to another user.");
        return;
      }
      await db.transact([tx.users[userId].update({ barcode })]);
      toast.success("Kiosk barcode updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update barcode.");
    }
  };

  const handleDepartmentSave = async (userId: string) => {
    if (!draft) {
      toast.error("Select a department.");
      return;
    }
    try {
      await db.transact([tx.users[userId].update({ deptId: draft })]);
      toast.success("Department updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update department.");
    }
  };

  async function allocateUniqueBarcodeForNewUser(): Promise<string> {
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = generateValidBarcode();
      const { data: existing } = await db.queryOnce({
        users: { $: { where: { barcode: candidate }, limit: 1 } },
      });
      if (!existing?.users?.length) return candidate;
    }
    throw new Error("Could not generate a unique kiosk barcode.");
  }

  const createDepartment = async () => {
    const name = newDeptName.trim();
    const departmentId = newDeptCode.trim();
    if (!name) {
      toast.error("Department display name is required.");
      return;
    }
    if (!departmentId) {
      toast.error("Department code is required (short id, e.g. ENG).");
      return;
    }
    const dup = (data?.departments ?? []).some(
      (d) => String(d.departmentId ?? "").trim() === departmentId
    );
    if (dup) {
      toast.error("That department code is already in use.");
      return;
    }
    setCreatingDept(true);
    try {
      const newId = id();
      await db.transact([
        tx.departments[newId].update({ name, departmentId }),
      ]);
      toast.success("Department created.");
      setNewDeptName("");
      setNewDeptCode("");
    } catch (e) {
      console.error(e);
      toast.error("Failed to create department.");
    } finally {
      setCreatingDept(false);
    }
  };

  const createUser = async () => {
    const name = newUserName.trim();
    const email = normalizeEmail(newUserEmail);
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email.");
      return;
    }
    if (!newUserDeptId) {
      toast.error("Select a department for this user.");
      return;
    }
    const barcodeInput = newUserBarcode.trim();
    let barcode = barcodeInput;
    if (barcode) {
      if (!verifyBarcode(barcode)) {
        toast.error(
          "Barcode must be a valid 20-character kiosk code, or leave blank to auto-generate."
        );
        return;
      }
      try {
        const { data: existing } = await db.queryOnce({
          users: { $: { where: { barcode }, limit: 1 } },
        });
        if (existing?.users?.length) {
          toast.error("That barcode is already assigned.");
          return;
        }
      } catch (e) {
        console.error(e);
        toast.error("Could not verify barcode.");
        return;
      }
    } else {
      try {
        barcode = await allocateUniqueBarcodeForNewUser();
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "Could not assign a barcode."
        );
        return;
      }
    }
    try {
      const { data: existingEmail } = await db.queryOnce({
        users: { $: { where: { email }, limit: 1 } },
      });
      if (existingEmail?.users?.length) {
        toast.error("That email is already registered.");
        return;
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not verify email.");
      return;
    }
    const now = Date.now();
    setCreatingUser(true);
    try {
      const newId = id();
      await db.transact([
        tx.users[newId].update({
          name,
          email,
          barcode,
          isAdmin: newUserIsAdmin,
          isAuth: false,
          lastLoginAt: now,
          createdAt: now,
          serverCreatedAt: now,
          deptId: newUserDeptId,
          laptopSerial: "",
          purpose: "",
        }),
      ]);
      toast.success("User created.");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserBarcode("");
      setNewUserDeptId("");
      setNewUserIsAdmin(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const beginDeptListEdit = (dept: {
    id: string;
    name?: string;
    departmentId?: string;
  }) => {
    setDeptListEditId(dept.id);
    setDeptListDraftName(dept.name ?? "");
    setDeptListDraftCode(String(dept.departmentId ?? ""));
  };

  const cancelDeptListEdit = () => {
    setDeptListEditId(null);
    setDeptListDraftName("");
    setDeptListDraftCode("");
  };

  const saveDeptListEdit = async () => {
    if (!deptListEditId) return;
    const name = deptListDraftName.trim();
    const departmentId = deptListDraftCode.trim();
    if (!name) {
      toast.error("Department name is required.");
      return;
    }
    if (!departmentId) {
      toast.error("Department code is required.");
      return;
    }
    const dup = (data?.departments ?? []).some(
      (d) =>
        d.id !== deptListEditId &&
        String(d.departmentId ?? "").trim() === departmentId
    );
    if (dup) {
      toast.error("Another department already uses that code.");
      return;
    }
    setSavingDeptList(true);
    try {
      await db.transact([
        tx.departments[deptListEditId].update({ name, departmentId }),
      ]);
      toast.success("Department updated.");
      cancelDeptListEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update department.");
    } finally {
      setSavingDeptList(false);
    }
  };

  const deleteDepartment = async (dept: {
    id: string;
    name?: string;
    departmentId?: string;
  }) => {
    const assigned = allUsers.filter((u) => u.deptId === dept.id).length;
    if (assigned > 0) {
      toast.error(
        `Cannot delete: ${assigned} user(s) are still assigned to this department. Reassign them first.`
      );
      return;
    }
    const ok = window.confirm(
      `Delete department "${dept.name ?? dept.id}" (${dept.departmentId})? This cannot be undone.`
    );
    if (!ok) return;
    try {
      await db.transact([tx.departments[dept.id].delete()]);
      toast.success("Department deleted.");
      if (deptListEditId === dept.id) cancelDeptListEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete department.");
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await db.transact([
        tx.users[userId].update({ isAdmin: !currentStatus }),
      ]);
      toast.success(
        currentStatus
          ? "Admin access removed."
          : "User is now an admin."
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update admin status.");
    }
  };

  const makeAuth = async (userId: string, currentStatus: boolean) => {
    try {
      await db.transact([tx.users[userId].update({ isAuth: !currentStatus })]);
      toast.success(
        currentStatus ? "Authorization revoked." : "Authorization granted."
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update authorization.");
    }
  };

  const deleteUser = async (userId: string, label: string) => {
    if (userId === currentAppUserId) {
      toast.error("You cannot delete your own account from here.");
      return;
    }
    const ok = window.confirm(
      `Delete user ${label}? This cannot be undone. Related punches may become orphaned.`
    );
    if (!ok) return;
    try {
      await db.transact([tx.users[userId].delete()]);
      toast.success("User deleted.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete user.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-700 dark:text-gray-300">
        Loading users…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-center text-red-600 dark:text-red-400">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl bg-gray-100 p-4 dark:bg-gray-900 sm:p-6">
      <Toaster position="top-right" />
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white sm:mb-6 sm:text-2xl">
        Users
      </h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Each person is a card so nothing is clipped on small screens.{" "}
        <strong>Kiosk barcode</strong> is what staff type or scan at check-in
        (sometimes called a badge ID or passcode).
      </p>

      <AdminCollapsible
        title="Add department or user"
        open={addSectionOpen}
        onToggle={toggleAddSection}
      >
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              New department
            </h3>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Display name appears in the app; department code is the stable id
              used for CSV import matching (e.g. ENG).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="admin-new-dept-name"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Display name
                </label>
                <input
                  id="admin-new-dept-name"
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Engineering"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-new-dept-code"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Department code
                </label>
                <input
                  id="admin-new-dept-code"
                  type="text"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="ENG"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={creatingDept}
              onClick={createDepartment}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creatingDept ? "Creating…" : "Create department"}
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6 dark:border-gray-600">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              New user
            </h3>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Kiosk authorization starts off; use the user card to grant access.
              Leave barcode blank to auto-generate a valid 20-character code.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="admin-new-user-name"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Name
                </label>
                <input
                  id="admin-new-user-name"
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="admin-new-user-email"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </label>
                <input
                  id="admin-new-user-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="admin-new-user-barcode"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Kiosk barcode (optional)
                </label>
                <input
                  id="admin-new-user-barcode"
                  type="text"
                  value={newUserBarcode}
                  onChange={(e) => setNewUserBarcode(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-new-user-dept"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Department
                </label>
                <select
                  id="admin-new-user-dept"
                  value={newUserDeptId}
                  onChange={(e) => setNewUserDeptId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select department…</option>
                  {departmentsSorted.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.departmentId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={newUserIsAdmin}
                    onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                  />
                  Admin user
                </label>
              </div>
            </div>
            <button
              type="button"
              disabled={creatingUser}
              onClick={createUser}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingUser ? "Creating…" : "Create user"}
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6 dark:border-gray-600">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Departments (edit or remove)
            </h3>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Delete is only allowed when no users reference that department.
            </p>
            {departmentsSorted.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No departments yet — create one above.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {departmentsSorted.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900/60"
                  >
                    {deptListEditId === d.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={deptListDraftName}
                          onChange={(e) => setDeptListDraftName(e.target.value)}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          placeholder="Display name"
                        />
                        <input
                          type="text"
                          value={deptListDraftCode}
                          onChange={(e) => setDeptListDraftCode(e.target.value)}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          placeholder="Department code"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={savingDeptList}
                            onClick={saveDeptListEdit}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingDeptList ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDeptListEdit}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {d.name}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({d.departmentId})
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => beginDeptListEdit(d)}
                            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDepartment(d)}
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </AdminCollapsible>

      <AdminCollapsible
        title="Import / export users (CSV)"
        open={csvSectionOpen}
        onToggle={toggleCsvSection}
      >
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Export uses the same columns as bulk import (
          {USER_IMPORT_CSV_HEADERS.join(", ")}). The file is built in your
          browser; import reads the CSV locally then sends it to the server as
          JSON (no multipart upload), which avoids many deploy-time upload
          restrictions.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={allUsers.length === 0}
            onClick={exportUsersCsv}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download all users as CSV
          </button>
          <a
            href="/api/admin/users/import/template"
            download
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Download import template
          </a>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-gray-600 dark:bg-gray-900/40">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Import from CSV
          </h3>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="mb-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-800 hover:file:bg-blue-100 dark:text-gray-300 dark:file:bg-blue-950/50 dark:file:text-blue-200"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) {
                clearImportFile();
                return;
              }
              try {
                const text = await file.text();
                setImportCsvText(text);
                setImportFileLabel(file.name);
                setLastImportPreview(null);
                toast.success(`Loaded ${file.name} (${text.length} characters).`);
              } catch (err) {
                console.error(err);
                toast.error(
                  "Could not read that file. Try a UTF-8 .csv export."
                );
                clearImportFile();
              }
            }}
          />
          {importFileLabel ? (
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Ready: {importFileLabel}
            </p>
          ) : null}

          <div className="mb-4 space-y-2 text-sm text-gray-800 dark:text-gray-200">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Overwrite</strong> existing users matched by email
                (otherwise those rows are skipped).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={importGenerateBarcode}
                onChange={(e) => setImportGenerateBarcode(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Generate barcode</strong> when the cell is blank.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={importCreateDept}
                onChange={(e) => setImportCreateDept(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Create department</strong> if{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                  department_name
                </code>{" "}
                does not match any existing department.
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={importBusy || !importCsvText?.trim()}
              onClick={runImportDryRun}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              {importBusy ? "Working…" : "Preview import (dry run)"}
            </button>
            <button
              type="button"
              disabled={importBusy || !importCsvText?.trim()}
              onClick={runImportApply}
              className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply import
            </button>
            <button
              type="button"
              disabled={!importCsvText}
              onClick={clearImportFile}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400"
            >
              Clear file
            </button>
          </div>

          {lastImportPreview ? (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-950/40">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Last result
                {lastImportPreview.dryRun ? " (dry run)" : ""}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
                <li>Created: {lastImportPreview.createdCount ?? 0}</li>
                <li>Updated: {lastImportPreview.updatedCount ?? 0}</li>
                <li>Skipped: {lastImportPreview.skippedCount ?? 0}</li>
                <li>
                  Departments created:{" "}
                  {lastImportPreview.departmentsCreatedCount ?? 0}
                </li>
                <li>
                  Row errors: {(lastImportPreview.rowErrors ?? []).length}
                </li>
              </ul>
              {(lastImportPreview.rowErrors ?? []).length > 0 ? (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-red-800 dark:bg-gray-900 dark:text-red-300">
                  {lastImportPreview.rowErrors
                    ?.map((r) => `Line ${r.line}: ${r.message}`)
                    .join("\n")}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </AdminCollapsible>

      <AdminCollapsible
        title="Users: browse & cards"
        open={usersListOpen}
        onToggle={toggleUsersListSection}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Search, filters, and sort apply to the cards below. Section state is
          remembered on this device.
        </p>
        <div className="mb-5 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div>
          <label
            htmlFor="admin-users-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Search
          </label>
          <input
            id="admin-users-search"
            type="search"
            autoComplete="off"
            placeholder="Name, email, or barcode…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
          {searchInput !== debouncedSearch && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Typing…
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Admin
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "All"],
                    ["yes", "Admins"],
                    ["no", "Not admin"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAdminFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterToggleClass(adminFilter === value)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Kiosk authorized
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "All"],
                    ["yes", "Yes"],
                    ["no", "No"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAuthFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterToggleClass(authFilter === value)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:min-w-[12rem]">
            <label
              htmlFor="admin-users-sort"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              Sort A–Z
            </label>
            <select
              id="admin-users-sort"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="barcode">Barcode</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Showing{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {displayUsers.length}
          </span>{" "}
          of {allUsers.length} user{allUsers.length === 1 ? "" : "s"}
        </p>
      </div>

      {displayUsers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white/60 px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-400">
          No users match your search or filters.
        </p>
      ) : (
      <ul className="space-y-4">
        {displayUsers.map((user) => {
          const editing =
            editField?.userId === user.id ? editField.field : null;

          return (
            <li
              key={user.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5"
            >
              <div className="flex flex-col gap-4">
                {/* Name */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Name
                  </div>
                  {editing === "name" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleNameSave(user.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        {user.name || "—"}
                      </span>
                      <button
                        type="button"
                        className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
                        onClick={() =>
                          beginEdit(user.id, "name", user.name ?? "")
                        }
                      >
                        Edit name
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Email
                  </div>
                  {editing === "email" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="email"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleEmailSave(user.id)}
                        >
                          Save email
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2 break-all">
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {user.email}
                      </span>
                      <button
                        type="button"
                        className="rounded-md bg-violet-50 px-2.5 py-1 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/40"
                        onClick={() =>
                          beginEdit(user.id, "email", user.email ?? "")
                        }
                      >
                        Change email
                      </button>
                    </div>
                  )}
                </div>

                {/* Kiosk barcode */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Kiosk barcode / badge ID
                  </div>
                  {editing === "barcode" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                        placeholder="Scanned or typed ID"
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleBarcodeSave(user.id)}
                        >
                          Save barcode
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="break-all rounded bg-gray-100 px-2 py-1 text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {user.barcode || "—"}
                      </code>
                      <button
                        type="button"
                        className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
                        onClick={() =>
                          beginEdit(
                            user.id,
                            "barcode",
                            user.barcode ?? ""
                          )
                        }
                      >
                        Set barcode
                      </button>
                    </div>
                  )}
                </div>

                {/* Department */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Department
                  </div>
                  {editing === "department" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      >
                        {departmentsSorted.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.departmentId})
                          </option>
                        ))}
                      </select>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleDepartmentSave(user.id)}
                        >
                          Save department
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {(() => {
                          const dept = departmentsSorted.find(
                            (d) => d.id === user.deptId
                          );
                          if (dept) {
                            return (
                              <>
                                <span className="font-medium">{dept.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {" "}
                                  ({dept.departmentId})
                                </span>
                              </>
                            );
                          }
                          return (
                            <span className="text-amber-700 dark:text-amber-300">
                              Unknown — id {user.deptId || "—"}
                            </span>
                          );
                        })()}
                      </span>
                      <button
                        type="button"
                        disabled={departmentsSorted.length === 0}
                        className="rounded-md bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/40"
                        onClick={() => {
                          const fallback = departmentsSorted[0]?.id ?? "";
                          const current =
                            departmentsSorted.some((d) => d.id === user.deptId)
                              ? (user.deptId as string)
                              : fallback;
                          beginEdit(user.id, "department", current);
                        }}
                      >
                        Change department
                      </button>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Admin
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isAdmin
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                      }`}
                    >
                      {user.isAdmin ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Authorized
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isAuth
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                          : "bg-gray-200 text-gray-800 dark:bg-gray-600/50 dark:text-gray-200"
                      }`}
                    >
                      {user.isAuth ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                {/* Actions — full-width grid, labels never truncated */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Quick actions
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/60 dark:text-white dark:hover:bg-gray-900"
                      onClick={() =>
                        toggleAdminStatus(user.id, Boolean(user.isAdmin))
                      }
                    >
                      {user.isAdmin ? "Remove admin role" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/60 dark:text-white dark:hover:bg-gray-900"
                      onClick={() => makeAuth(user.id, Boolean(user.isAuth))}
                    >
                      {user.isAuth
                        ? "Revoke kiosk authorization"
                        : "Grant kiosk authorization"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                  <button
                    type="button"
                    disabled={user.id === currentAppUserId}
                    className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                    onClick={() =>
                      deleteUser(
                        user.id,
                        user.name || user.email || user.id
                      )
                    }
                  >
                    {user.id === currentAppUserId
                      ? "Cannot delete your own account"
                      : "Delete user"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}
      </AdminCollapsible>
    </div>
  );
}
