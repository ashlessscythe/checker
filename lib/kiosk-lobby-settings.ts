/** Singleton row lookup for `kioskLobbySettings` in InstantDB. */
export const KIOSK_LOBBY_SETTINGS_KEY = "default";

export type KioskLobbySettingsRow = {
  id: string;
  key: string;
  vendorCheckInEnabled?: boolean;
  visitorGuestCheckInEnabled?: boolean;
  updatedAt?: number;
};

/** Query slice shape from Instant `kioskLobbySettings` (first row drives flags). */
export type KioskLobbySettingsQueryRow = Pick<
  KioskLobbySettingsRow,
  "vendorCheckInEnabled" | "visitorGuestCheckInEnabled"
> &
  Partial<Pick<KioskLobbySettingsRow, "id" | "key">>;

/** When no row exists yet, lobby features are treated as enabled. */
export function isVendorCheckInEnabled(
  rows: KioskLobbySettingsQueryRow[] | undefined
): boolean {
  const r = rows?.[0];
  if (!r) return true;
  return r.vendorCheckInEnabled !== false;
}

export function isVisitorGuestCheckInEnabled(
  rows: KioskLobbySettingsQueryRow[] | undefined
): boolean {
  const r = rows?.[0];
  if (!r) return true;
  return r.visitorGuestCheckInEnabled !== false;
}
