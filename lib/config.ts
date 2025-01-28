// lib/config.ts
export const getAutoNavigateTimeout = () => {
  const envTimeout = process.env.NEXT_PUBLIC_AUTO_RELOAD_MINUTES;
  // Convert minutes to milliseconds, default to 5 minutes if not set
  return parseInt(envTimeout || "5", 10) * 60 * 1000;
};

if (!process.env.NEXT_PUBLIC_INSTANT_APP_ID) {
  throw new Error(
    "NEXT_PUBLIC_INSTANT_APP_ID is not set in environment variables"
  );
}

export const INSTANT_APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
