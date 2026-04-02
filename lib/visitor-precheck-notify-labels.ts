/** Human-readable label for how the pre-check request started (matches host-review copy). */
export function visitorPrecheckRequestSourceLabel(requestSource: string): string {
  const s = String(requestSource || "").trim();
  if (s === "kiosk_register") return "Lobby check-in tablet";
  if (s === "admin") return "Pre-check invitation (email from admin)";
  if (s === "kiosk_email" || s === "kiosk") {
    return "Lobby check-in (email link)";
  }
  return s ? `Other (${s})` : "Unknown";
}

export function visitorPrecheckApprovedByLabel(approvedBy: string): string {
  const b = String(approvedBy || "").trim();
  if (b === "host") return "Host (pre-check review link)";
  if (b === "admin") return "Administrator (admin panel)";
  return b || "Unknown";
}
