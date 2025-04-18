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
