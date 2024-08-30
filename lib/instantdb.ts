// lib/instantdb.ts
import { init } from "@instantdb/react";
import { INSTANT_APP_ID } from "./config";
import graph from "./schema";

// Replace with your actual app ID
const APP_ID = INSTANT_APP_ID;

export const db = init<typeof graph>({ appId: APP_ID });
