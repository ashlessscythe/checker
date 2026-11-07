import type { InstantRules } from "@instantdb/react";

// isAdmin / isAuthorized are read through the $users -> users link, which is created
// server-side only (app/api/auth/link-user, scripts/link-auth-users.ts).
const BIND = [
  "isAdmin", "true in auth.ref('$user.appUser.isAdmin')",
  "isAuthorized", "true in auth.ref('$user.appUser.isAuth')",
  "isSignedIn", "auth.id != null",
];

type Allow = { view: string; create: string; update: string; delete: string };
const ns = (allow: Allow) => ({ allow, bind: BIND });

const adminOnly = ns({ view: "isAdmin", create: "isAdmin", update: "isAdmin", delete: "isAdmin" });
const serverOnly = ns({ view: "false", create: "false", update: "false", delete: "false" });
const publicReadAdminWrite = ns({ view: "true", create: "isAdmin", update: "isAdmin", delete: "isAdmin" });
const staffReadWrite = ns({
  view: "isAdmin || isAuthorized",
  create: "isAdmin || isAuthorized",
  update: "isAdmin || isAuthorized",
  delete: "isAdmin",
});

const rules = {
  users: ns({
    view: "true",
    create:
      "isAdmin || (isSignedIn && newData.email == auth.email && newData.isAdmin == false && newData.isAuth == false)",
    update:
      "isAdmin || (isSignedIn && auth.email == data.email && newData.isAdmin == data.isAdmin && newData.isAuth == data.isAuth && newData.email == data.email)",
    delete: "isAdmin",
  }),
  // Anonymous kiosk reads/creates punches directly (see README of residual risks).
  punches: ns({ view: "true", create: "true", update: "isAdmin", delete: "isAdmin" }),
  departments: ns({ view: "isAdmin || isAuthorized", create: "isAdmin", update: "isAdmin", delete: "isAdmin" }),
  vendorCheckins: ns({ view: "isAdmin || isAuthorized", create: "false", update: "false", delete: "false" }),
  backups: adminOnly,
  visitors: adminOnly,
  revokedPrecheckTokens: adminOnly,
  visitorApprovalNotifyRecipients: adminOnly,
  fireDrillNotificationRecipients: adminOnly,
  fireDrillReportSends: adminOnly,
  fireDrillChecks: adminOnly,
  firedrills: adminOnly,
  fireDrillConfig: staffReadWrite,
  fireDrillSessions: staffReadWrite,
  fireDrillSessionParticipants: staffReadWrite,
  fireDrillAccounts: staffReadWrite,
  visitOptions: publicReadAdminWrite,
  kioskLobbySettings: publicReadAdminWrite,
  vendors: publicReadAdminWrite,
  vendorReasons: publicReadAdminWrite,
  visitorPrecheckRequests: ns({
    view: "true",
    create: "newData.status == 'pending'",
    update: "isAdmin || (data.status == 'pending' && newData.status == 'pending')",
    delete: "isAdmin",
  }),
  visitorInvites: serverOnly,
  visitorProtocolDocuments: serverOnly,
  auditLogs: serverOnly,
  apiKeys: serverOnly,
} satisfies InstantRules;

export default rules;
