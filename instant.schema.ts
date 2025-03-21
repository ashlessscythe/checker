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
      timestamp: i.number().indexed(), // added indexed
      serverCreatedAt: i.number(), // Adding serverCreatedAt for sorting
      isAdminGenerated: i.boolean(), // From inferred schema
      isSystemGenerated: i.boolean(), // From inferred schema
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
  },
  links: {
    // Important: Updating the relationship to match the code's expectations
    // The code expects a punch to have multiple users
    usersPunches: {
      forward: {
        on: "users",
        has: "many",
        label: "punches",
      },
      reverse: {
        on: "punches",
        has: "many", // Changed from "one" to "many" to match code expectations
        label: "users",
      },
    },
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
