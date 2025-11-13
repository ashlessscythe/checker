/**
 * Generates and persists a device identifier.
 * Uses localStorage to persist the device ID across sessions.
 * Returns a short identifier (last 4 hex characters of a hash).
 */

const DEVICE_ID_KEY = "checker_device_id";

/**
 * Generates a simple hash from browser fingerprint data
 */
function generateDeviceHash(): string {
  // Collect browser fingerprint data
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform,
  ].join("|");

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and get last 4 characters
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return hex.slice(-4).toUpperCase();
}

/**
 * Gets or creates a device identifier.
 * The identifier is persisted in localStorage and reused across sessions.
 * Returns a 4-character hex code (e.g., "A3F2").
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    // Server-side: return a default value
    return "SRVR";
  }

  try {
    // Try to get existing device ID from localStorage
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate a new device ID
      deviceId = generateDeviceHash();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    // If localStorage is not available, generate a temporary ID
    console.warn("localStorage not available, using temporary device ID");
    return generateDeviceHash();
  }
}
