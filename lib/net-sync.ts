/**
 * Background network-aware sync manager.
 *
 * Behaviour:
 * - On app foreground / app start: immediately attempt to flush queues if online
 * - While app is active: poll every 60 s — if online, flush queues
 * - Uses a lightweight HEAD probe to the API base to check connectivity
 *   (no extra package required)
 */
import { AppState, AppStateStatus } from "react-native";
import { gpsQueueFlush } from "./gps-queue";
import { processSyncQueue } from "./sync-queue";

const BASE_URL = "https://disguisedly-enarthrodial-kristi.ngrok-free.dev/api/v1";
const PING_URL  = `${BASE_URL}/ping`;          // lightweight endpoint — falls back gracefully on 404
const INTERVAL_MS = 60_000;                    // 1 minute

let _timer: ReturnType<typeof setInterval> | null = null;
let _appStateSub: { remove(): void } | null = null;
let _flushing = false;

/** Returns true if the device can reach the API server. */
async function isOnline(): Promise<boolean> {
  try {
    const res = await fetch(PING_URL, {
      method: "HEAD",
      headers: { "ngrok-skip-browser-warning": "1" },
      signal: AbortSignal.timeout(5_000),     // 5-second timeout
    });
    // Any HTTP response (even 404) means we're online
    return res.status < 600;
  } catch {
    return false;
  }
}

/** Flush both queues if online. Safe to call concurrently — guarded by _flushing flag. */
async function tryFlush(): Promise<void> {
  if (_flushing) return;
  _flushing = true;
  try {
    const online = await isOnline();
    if (!online) return;
    await Promise.allSettled([processSyncQueue(), gpsQueueFlush()]);
  } finally {
    _flushing = false;
  }
}

/** Start the background sync manager. Call once from the root layout. */
export function startNetSync(): void {
  // Immediate attempt on start
  tryFlush();

  // Poll every 60 s
  if (_timer) clearInterval(_timer);
  _timer = setInterval(tryFlush, INTERVAL_MS);

  // Also flush whenever the app comes back to the foreground
  if (_appStateSub) _appStateSub.remove();
  _appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") tryFlush();
  });
}

/** Stop the background sync manager (e.g. on logout). */
export function stopNetSync(): void {
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_appStateSub) { _appStateSub.remove(); _appStateSub = null; }
}
