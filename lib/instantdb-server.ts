import { init, tx } from "@instantdb/react";
import schema from "../instant.schema";
import { INSTANT_APP_ID } from "./config";

const APP_ID = INSTANT_APP_ID;

export const serverDb = init<typeof schema>({ appId: APP_ID });
export { tx };

