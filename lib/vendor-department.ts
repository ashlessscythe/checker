import { id, tx } from "@instantdb/admin";

type AdminAPI = ReturnType<
  typeof import("@/lib/instantdb-admin").requireAdminAPI
>;

/** Ensures a `departments` row with `departmentId: "VENDOR"` exists; returns its entity id. */
export async function ensureVendorDepartmentId(
  adminAPI: AdminAPI
): Promise<string> {
  const deptData = await adminAPI.query({
    departments: {
      $: {
        where: { departmentId: "VENDOR" },
      },
    },
  });
  const list = (deptData as { departments?: Array<{ id: string }> })
    ?.departments;
  if (!list || list.length === 0) {
    const vendorDeptId = id();
    await adminAPI.transact([
      tx.departments[vendorDeptId].update({
        name: "Vendors",
        departmentId: "VENDOR",
      }),
    ]);
    return vendorDeptId;
  }
  return list[0].id;
}
