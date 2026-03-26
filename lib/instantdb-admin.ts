import { init } from "@instantdb/admin";
import { INSTANT_APP_ID } from "./config";

const adminToken = process.env.INSTANT_ADMIN_TOKEN;

export const adminAPI = adminToken
  ? init({
      appId: INSTANT_APP_ID,
      adminToken,
    })
  : null;

export function requireAdminAPI() {
  if (!adminAPI) {
    throw new Error("INSTANT_ADMIN_TOKEN is not set in environment variables");
  }
  return adminAPI;
}
