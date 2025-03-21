// lib/instantdb.ts
import { init, tx } from "@instantdb/react";
import { INSTANT_APP_ID } from "./config";
import schema from "../instant.schema"; // Updated import path

// Replace with your actual app ID
const APP_ID = INSTANT_APP_ID;

export const db = init<typeof schema>({ appId: APP_ID });
export { tx };
