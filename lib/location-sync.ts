/**
 * Live location sync — pings the backend every 60 s with the lineman's
 * current GPS coordinates so the web dashboard can show them on the live map.
 *
 * Only runs when:
 *  - The user is logged in (token present)
 *  - The user has granted foreground location permission
 *  - The app is in the foreground
 */
import { AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { tokenStore } from "./token";

const BASE_URL    = "https://disguisedly-enarthrodial-kristi.ngrok-free.dev/api/v1";
const PING_URL    = `${BASE_URL}/lineman-location`;
const INTERVAL_MS = 60_000; // 1 minute

let _timer: ReturnType<typeof setInterval> | null = null;
let _appStateSub: { remove(): void } | null = null;
let _running = false;

/** Post current GPS to the server. Silently ignores errors. */
async function sendLocation(): Promise<void> {
  try {
    const token = await tokenStore.get();
    if (!token) { console.log("[LocationSync] No token — skipping ping"); return; }

    // Check permission without prompting again
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") { console.log("[LocationSync] Permission not granted:", status); return; }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    console.log("[LocationSync] Pinging", PING_URL, pos.coords.latitude, pos.coords.longitude);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(PING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.log("[LocationSync] Response status:", res.status);
  } catch (e) {
    console.log("[LocationSync] Error:", e);
  }
}

/** Request foreground location permission, then start pinging. */
export async function startLocationSync(): Promise<void> {
  // Allow re-init (e.g. called again after login) — tear down old interval first
  if (_running) {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_appStateSub) { _appStateSub.remove(); _appStateSub = null; }
    _running = false;
  }
  _running = true;

  // Request permission (shows the system dialog if not yet decided)
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    _running = false;
    return;
  }

  // Immediate first ping
  sendLocation();

  // Poll every 60 s
  if (_timer) clearInterval(_timer);
  _timer = setInterval(sendLocation, INTERVAL_MS);

  // Also ping whenever the app comes back to foreground
  if (_appStateSub) _appStateSub.remove();
  _appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") sendLocation();
  });
}

/**
 * Fire a single immediate ping — call this right after login
 * so we don't wait up to 60 s for the first location to appear.
 */
export function pingLocationNow(): void {
  sendLocation();
}

/** Stop pinging (call on logout). */
export function stopLocationSync(): void {
  _running = false;
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_appStateSub) { _appStateSub.remove(); _appStateSub = null; }
}
