/** User-facing message for admin API route catch blocks. */
export function formatAdminApiError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unexpected error.";
  const causeCode =
    error instanceof Error &&
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause
      ? String((error.cause as { code?: string }).code)
      : undefined;

  if (message === "INSTANT_ADMIN_TOKEN is not set in environment variables") {
    return "INSTANT_ADMIN_TOKEN is missing. Add it to .env and restart the dev server.";
  }

  if (message === "fetch failed") {
    const net = causeCode ? ` (${causeCode})` : "";
    return `Server could not reach InstantDB${net}. Check network/VPN/firewall, confirm INSTANT_ADMIN_TOKEN in .env matches your Instant app, then restart npm run dev.`;
  }

  return message;
}
