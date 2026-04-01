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
      category: i.string(), // 'who' | 'why'
      label: i.string(),
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
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
