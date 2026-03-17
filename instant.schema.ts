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
