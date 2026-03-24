/** Display name for visitor pre-check: submitted legal-style name, else invite hint, else email. */
export function visitorPrecheckDisplayName(fields: {
  visitorFirstName?: string | null;
  visitorLastName?: string | null;
  invitedName?: string | null;
  email: string;
}): string {
  const f = (fields.visitorFirstName ?? "").trim();
  const l = (fields.visitorLastName ?? "").trim();
  const combined = [f, l].filter(Boolean).join(" ");
  if (combined) return combined;
  const invited = (fields.invitedName ?? "").trim();
  if (invited) return invited;
  return fields.email;
}
