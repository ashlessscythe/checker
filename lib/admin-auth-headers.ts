import { db } from "@/lib/instantdb";

/** Bearer header for `/api/admin/*` routes (verified server-side by requireSignedInAdmin). */
export async function adminAuthHeaders(): Promise<Record<string, string>> {
  const user = await db.getAuth();
  if (!user?.refresh_token) {
    throw new Error("Not signed in.");
  }
  return { Authorization: `Bearer ${user.refresh_token}` };
}
