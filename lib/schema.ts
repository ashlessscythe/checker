import { i } from "@instantdb/core";
import { INSTANT_APP_ID } from "./config";

const graph = i.graph(
  INSTANT_APP_ID,
  {
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
    }),
    punches: i.entity({
      type: i.string(),
      timestamp: i.number(),
      serverCreatedAt: i.number(), // Adding serverCreatedAt for sorting
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
  {
    userPunches: {
      forward: {
        on: "users",
        has: "many",
        label: "punches",
      },
      reverse: {
        on: "punches",
        has: "one",
        label: "user",
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
  }
);

export default graph;
