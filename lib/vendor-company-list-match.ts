import { normName } from "@/lib/vendor-kiosk-server";

export type VendorListEntry = {
  id: string;
  name: string;
  isActive?: boolean;
};

/** Active vendor whose name matches typed text (trimmed, case-insensitive). */
export function findVendorListMatchByTypedName(
  vendors: VendorListEntry[],
  typedName: string
): VendorListEntry | null {
  const key = normName(typedName);
  if (!key) return null;
  for (const v of vendors) {
    if (v.isActive === false) continue;
    if (normName(v.name) === key) return v;
  }
  return null;
}

export function vendorInListSelectFromDropdownMessage(vendorName: string): string {
  const name = vendorName.trim() || "That company";
  return `Vendor ${name} is in the list, select from dropdown.`;
}
