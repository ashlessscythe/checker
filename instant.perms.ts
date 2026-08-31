// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  /**
   * API key hashes must never be readable or writable from the browser SDK.
   * Key create/list/revoke goes through server routes that use INSTANT_ADMIN_TOKEN.
   */
  apiKeys: {
    allow: {
      view: "false",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
