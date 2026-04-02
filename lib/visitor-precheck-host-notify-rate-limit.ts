/**
 * Host pre-check notification emails only (Resend in sendHostPrecheckNotificationEmail).
 * Not used by kiosk check-in/out or punch writes — those stay on InstantDB only.
 *
 * At most 2 sends per rolling 1s window; requests are serialized so concurrent callers
 * cannot burst past the limit. In serverless multi-instance deploys, each instance has
 * its own counter.
 */

const WINDOW_MS = 1000;
const MAX_SENDS_PER_WINDOW = 2;
const sendTimestamps: number[] = [];

let chain: Promise<void> = Promise.resolve();

async function throttleAcquire(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (sendTimestamps.length > 0 && now - sendTimestamps[0]! >= WINDOW_MS) {
      sendTimestamps.shift();
    }
    if (sendTimestamps.length < MAX_SENDS_PER_WINDOW) {
      sendTimestamps.push(Date.now());
      return;
    }
    const oldest = sendTimestamps[0]!;
    await new Promise((r) =>
      setTimeout(r, Math.max(1, WINDOW_MS - (now - oldest) + 1))
    );
  }
}

/** Wait until this send is allowed under the 2/sec limit, then return. */
export async function waitForHostNotifyEmailRateLimit(): Promise<void> {
  const next = chain.then(() => throttleAcquire());
  chain = next.catch(() => {});
  await next;
}
