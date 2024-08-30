// lib/schema.ts
import { i } from "@instantdb/core";
import { INSTANT_APP_ID } from "./config";

const graph = i.graph(
  INSTANT_APP_ID,
  {
    users: i.entity({
      name: i.string(),
      barcode: i.string(),
      isAdmin: i.boolean(),
    }),
    punches: i.entity({
      type: i.string(),
      timestamp: i.number(),
    }),
    admin_users: i.entity({
      // This entity is empty as it's just a relation to users
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
    adminUsers: {
      forward: {
        on: "users",
        has: "one",
        label: "adminUser",
      },
      reverse: {
        on: "admin_users",
        has: "one",
        label: "user",
      },
    },
  }
);

export default graph;
