/**
 * Public base URL for links in emails and server-side calls to this app.
 *
 * In local dev, `http://127.0.0.1` and `http://localhost` are different browser
 * origins; Turnstile + some email clients behave more predictably with
 * `localhost`. If `NEXT_PUBLIC_APP_BASE_URL` uses 127.0.0.1, we normalize to
 * localhost only when `NODE_ENV === "development"`.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const trimmed = raw.replace(/\/+$/, "");

  if (process.env.NODE_ENV !== "development") {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    if (u.hostname === "127.0.0.1") {
      u.hostname = "localhost";
      return u.toString().replace(/\/+$/, "");
    }
  } catch {
    /* ignore invalid URL */
  }

  return trimmed;
}
