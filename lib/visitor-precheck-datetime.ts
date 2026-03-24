/**
 * Visitor-facing date/time strings (emails, PDF). Uses IANA timezone so server
 * locale (often UTC) does not shift times away from what visitors expect.
 * Aligns with invite email link expiry formatting.
 */
const visitorDisplayTimeZone =
  process.env.NEXT_PUBLIC_VISITOR_DISPLAY_TIMEZONE ||
  process.env.VISITOR_DISPLAY_TIMEZONE ||
  "America/Denver";

export function formatVisitorPrecheckWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: visitorDisplayTimeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}
