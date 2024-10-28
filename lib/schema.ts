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
      createdAt: i.number(), // Adding createdAt field
      deptId: i.string(), // Adding deptId field for department association
    }),
    punches: i.entity({
      type: i.string(),
      timestamp: i.number(),
    }),
    departments: i.entity({
      // Adding departments entity
      name: i.string(),
      departmentId: i.string(), // This corresponds to the deptId in users
    }),
    backups: i.entity({
      // backups stuffs
      timestamp: i.number(),
      type: i.string(),
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
      // Adding relationship between users and departments
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
  }
);

export default graph;
