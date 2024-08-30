// lib/config.ts
if (!process.env.NEXT_PUBLIC_INSTANT_APP_ID) {
  throw new Error(
    "NEXT_PUBLIC_INSTANT_APP_ID is not set in environment variables"
  );
}

export const INSTANT_APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
