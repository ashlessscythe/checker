import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  KIOSK_LOBBY_SETTINGS_KEY,
  isVendorCheckInEnabled,
  isVisitorGuestCheckInEnabled,
} from "@/lib/kiosk-lobby-settings";

type AdminAPI = ReturnType<typeof requireAdminAPI>;

export async function getVendorLobbyEnabledFromDb(
  adminAPI: AdminAPI
): Promise<boolean> {
  const data = (await adminAPI.query({
    kioskLobbySettings: {
      $: { where: { key: KIOSK_LOBBY_SETTINGS_KEY } },
    },
  })) as { kioskLobbySettings?: Array<{ vendorCheckInEnabled?: boolean }> };
  return isVendorCheckInEnabled(data.kioskLobbySettings);
}

export async function getVisitorGuestLobbyEnabledFromDb(
  adminAPI: AdminAPI
): Promise<boolean> {
  const data = (await adminAPI.query({
    kioskLobbySettings: {
      $: { where: { key: KIOSK_LOBBY_SETTINGS_KEY } },
    },
  })) as { kioskLobbySettings?: Array<{ visitorGuestCheckInEnabled?: boolean }> };
  return isVisitorGuestCheckInEnabled(data.kioskLobbySettings);
}
