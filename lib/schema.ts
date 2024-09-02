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
    }),
    punches: i.entity({
      type: i.string(),
      timestamp: i.number(),
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
  }
);

export default graph;
