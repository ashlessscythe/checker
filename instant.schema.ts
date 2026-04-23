// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    // System entities
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.any(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    // Custom entities
    users: i.entity({
      name: i.string(),
      email: i.string(),
      barcode: i.string(),
      isAdmin: i.boolean(),
      isAuth: i.boolean(),
      lastLoginAt: i.number(),
      createdAt: i.number(),
      deptId: i.string(),
      serverCreatedAt: i.number(), // Adding serverCreatedAt for sorting
      laptopSerial: i.string(), // For visitors with laptops
      purpose: i.string(), // For visitor purpose
    }),
    punches: i.entity({
      type: i.string(),
      timestamp: i.number().indexed(),
      serverCreatedAt: i.number(),
      isAdminGenerated: i.boolean(),
      isSystemGenerated: i.boolean(),
      userId: i.string().indexed(), // Add direct reference to user
      device: i.string(), // Device identifier (short code like last 4 hex chars)
    }),
    departments: i.entity({
      name: i.string(),
      departmentId: i.string(),
    }),
    backups: i.entity({
      timestamp: i.number(),
      type: i.string(),
    }),
    fireDrillChecks: i.entity({
      drillId: i.string(),
      userId: i.string(),
      timestamp: i.number(),
      status: i.string(), // 'checked' or 'unchecked'
      accountedBy: i.string(),
    }),
    firedrills: i.entity({
      drillId: i.string(),
      completedAt: i.number(),
      totalChecked: i.number(),
      totalPresent: i.number(),
    }),
    /**
     * Fire drill v2 (session-based).
     *
     * Legacy entities (`fireDrillChecks`, `firedrills`) are kept for backwards compatibility.
     */
    fireDrillConfig: i.entity({
      /**
       * Singleton lookup key.
       * Instant entity IDs must be UUIDs, so we store a unique key instead of forcing a fixed id.
       */
      key: i.string().unique().indexed(),
      activeSessionId: i.string(),
      updatedAt: i.number(),
    }),
    fireDrillSessions: i.entity({
      status: i.string(), // 'active' | 'completed' | 'cancelled'
      startedAt: i.number().indexed(),
      completedAt: i.number().indexed(),
      startedByUserId: i.string().indexed(),
      completedByUserId: i.string().indexed(),
      notes: i.string(),
      presentSnapshotAtStart: i.boolean(),
    }),
    fireDrillSessionParticipants: i.entity({
      sessionId: i.string().indexed(),
      userId: i.string().indexed(),
      isPresentAtStart: i.boolean(),
      presentReason: i.string(), // 'checked_in' | 'forced' | 'unknown'
    }),
    fireDrillAccounts: i.entity({
      sessionId: i.string().indexed(),
      userId: i.string().indexed(),
      status: i.string(), // 'accounted' | 'unaccounted'
      timestamp: i.number().indexed(),
      accountedByUserId: i.string().indexed(),
      accountedByName: i.string(),
    }),
    fireDrillNotificationRecipients: i.entity({
      email: i.string().unique().indexed(),
      name: i.string(),
      isActive: i.boolean(),
      createdAt: i.number(),
    }),
    fireDrillReportSends: i.entity({
      sessionId: i.string().indexed(),
      sentAt: i.number().indexed(),
      sentByUserId: i.string().indexed(),
      recipientEmails: i.any(), // string[]
      subject: i.string(),
      summary: i.any(),
    }),
    // Visitor pre-check related entities
    visitors: i.entity({
      name: i.string(),
      email: i.string(),
      barcode: i.string(), // Visitor barcode used for kiosk check-in
      visitDate: i.number(), // UTC timestamp for scheduled visit start
      hostName: i.string(), // Who they are visiting (display)
      reason: i.string(), // Reason for visit (display or free text)
      otherDetails: i.string(), // Optional free-text details
      createdAt: i.number(),
      precheckedAt: i.number(), // When visitor completed pre-check
    }),
    visitorInvites: i.entity({
      email: i.string().indexed(),
      token: i.string().unique().indexed(),
      tokenExpiresAt: i.number(),
      tokenUsedAt: i.number(),
      status: i.string(), // 'pending', 'completed', 'expired', 'cancelled'
      visitorId: i.string(), // Link to visitors entity once pre-check done
      hostOption: i.string(), // Selected "who/whom" option identifier or label
      reasonOption: i.string(), // Selected "why" option identifier or label
      visitDate: i.number(), // Scheduled visit date/time (UTC)
      createdAt: i.number(),
      lastEmailSentAt: i.number(), // For auditing/resend logic
    }),
    visitOptions: i.entity({
      category: i.string(), // 'who' | 'why' | 'company'
      label: i.string(),
      /** When category is "who", optional email to notify that host for pre-check approvals. */
      hostEmail: i.string(),
      isActive: i.boolean(),
      sortOrder: i.number(),
      createdAt: i.number(),
    }),
    auditLogs: i.entity({
      type: i.string(), // e.g. 'precheck_email_sent', 'precheck_completed', 'kiosk_checkin'
      message: i.string(),
      metadata: i.any(),
      createdAt: i.number(),
    }),
    // Tokens invalidated when admin deletes a pre-check row (approved removal or stale pending).
    revokedPrecheckTokens: i.entity({
      token: i.string().unique().indexed(),
      revokedAt: i.number(),
      reason: i.string(), // e.g. approved_record_removed | pending_request_removed
    }),
    visitorPrecheckRequests: i.entity({
      // HMAC-signed token from email link; unique to enforce single submission
      token: i.string().unique().indexed(),
      email: i.string().indexed(),
      status: i.string(), // 'pending' | 'approved' | 'rejected'

      // Where the request came from: admin invite, kiosk email link, or on-device register
      requestSource: i.string().indexed(), // 'admin' | 'kiosk_email' | 'kiosk_register' (legacy 'kiosk' = kiosk_email)

      // Optional personalization name (admin can provide; kiosk defaults to email)
      invitedName: i.string(),

      // Visitor-submitted fields
      visitorFirstName: i.string(),
      visitorLastName: i.string(),
      visitorCompanyName: i.string(), // required on form submit
      who: i.string(),
      reason: i.string(),
      otherDetails: i.string(),
      visitDate: i.number(), // UTC timestamp

      // Lifecycle / admin decision
      submittedAt: i.number(),
      approvedAt: i.number(),
      rejectedAt: i.number(),
      approvedBy: i.string(),
      rejectedBy: i.string(),
      adminMessage: i.string(), // optional message provided by admin on approve
      rejectionMessage: i.string(), // optional message provided by admin on reject

      // Kiosk barcode is generated at approval time
      visitorBarcode: i.string(),
      visitorUserId: i.string(), // created when approved
      protocolRequired: i.boolean(),
      protocolAcknowledgedAt: i.number(),

      createdAt: i.number(),
      lastUpdatedAt: i.number(),
    }),
    visitorProtocolDocuments: i.entity({
      key: i.string().unique().indexed(),
      fileName: i.string(),
      mimeType: i.string(),
      contentBase64: i.string(),
      byteSize: i.number(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    /** Staff who receive an internal summary email when a visitor pre-check is approved (not the visitor). */
    visitorApprovalNotifyRecipients: i.entity({
      email: i.string().unique().indexed(),
      name: i.string(),
      sortOrder: i.number(),
      createdAt: i.number(),
    }),
    /** Service companies for vendor kiosk (dropdown on site). */
    vendors: i.entity({
      name: i.string(),
      sortOrder: i.number(),
      isActive: i.boolean(),
      createdAt: i.number(),
    }),
    /** Visit reasons configured per vendor (kiosk shows "Other" in UI without a row). */
    vendorReasons: i.entity({
      label: i.string(),
      sortOrder: i.number(),
      isActive: i.boolean(),
      createdAt: i.number(),
    }),
    /**
     * One row per vendor site visit; links to temp `users` (VENDOR dept) for punches / fire drill.
     * `sixDigitCode` is unique and shown to the vendor for checkout.
     */
    vendorCheckins: i.entity({
      sixDigitCode: i.string().unique().indexed(),
      companyDisplayName: i.string(),
      /** `vendors` entity id when chosen from list; empty when company is "Other". */
      vendorListId: i.string(),
      reasonDisplay: i.string(),
      firstName: i.string(),
      lastName: i.string(),
      firstNameNorm: i.string().indexed(),
      lastNameNorm: i.string().indexed(),
      checkedOutAt: i.number().indexed(),
      createdAt: i.number(),
    }),
    /**
     * Singleton lobby flags (key `default`). When missing, app treats both as enabled.
     */
    kioskLobbySettings: i.entity({
      key: i.string().unique().indexed(),
      vendorCheckInEnabled: i.boolean(),
      visitorGuestCheckInEnabled: i.boolean(),
      updatedAt: i.number(),
    }),
  },
  links: {
    userDepartment: {
      forward: {
        on: "users",
        has: "one",
        label: "department",
      },
      reverse: {
        on: "departments",
        has: "many",
        label: "users",
      },
    },
    userFireDrillChecks: {
      forward: {
        on: "users",
        has: "many",
        label: "fireDrillChecks",
      },
      reverse: {
        on: "fireDrillChecks",
        has: "one",
        label: "user",
      },
    },
    fireDrillSessionParticipantsLink: {
      forward: {
        on: "fireDrillSessions",
        has: "many",
        label: "participants",
      },
      reverse: {
        on: "fireDrillSessionParticipants",
        has: "one",
        label: "session",
      },
    },
    fireDrillSessionAccountsLink: {
      forward: {
        on: "fireDrillSessions",
        has: "many",
        label: "accounts",
      },
      reverse: {
        on: "fireDrillAccounts",
        has: "one",
        label: "session",
      },
    },
    fireDrillAccountUserLink: {
      forward: {
        on: "users",
        has: "many",
        label: "fireDrillAccounts",
      },
      reverse: {
        on: "fireDrillAccounts",
        has: "one",
        label: "user",
      },
    },
    fireDrillParticipantUserLink: {
      forward: {
        on: "users",
        has: "many",
        label: "fireDrillParticipants",
      },
      reverse: {
        on: "fireDrillSessionParticipants",
        has: "one",
        label: "user",
      },
    },
    fireDrillSessionReportSendsLink: {
      forward: {
        on: "fireDrillSessions",
        has: "many",
        label: "reportSends",
      },
      reverse: {
        on: "fireDrillReportSends",
        has: "one",
        label: "session",
      },
    },
    vendorReasonVendorLink: {
      forward: {
        on: "vendorReasons",
        has: "one",
        label: "vendor",
      },
      reverse: {
        on: "vendors",
        has: "many",
        label: "reasons",
      },
    },
    vendorCheckinUserLink: {
      forward: {
        on: "vendorCheckins",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "users",
        has: "many",
        label: "vendorCheckins",
      },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
