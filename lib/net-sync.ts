/**
 * Background network-aware sync manager.
 *
 * - On app start: immediately attempt to flush queues if online
 * - Every 5 minutes: if online, flush queues
 * - Also flushes whenever the app comes back to the foreground
 */
import { AppState, AppStateStatus } from "react-native";
import { gpsQueueFlush } from "./gps-queue";
import { processSyncQueue } from "./sync-queue";

const PING_URL    = "https://darkseagreen-meerkat-296232.hostingersite.com/api/v1/status";
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _timer: ReturnType<typeof setInterval> | null = null;
let _appStateSub: { remove(): void } | null = null;
let _flushing = false;

async function isOnline(): Promise<boolean> {
  try {
    const res = await fetch(PING_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });
    return res.status < 600;
  } catch {
    return false;
  }
}

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

export function startNetSync(): void {
  tryFlush();

  if (_timer) clearInterval(_timer);
  _timer = setInterval(tryFlush, INTERVAL_MS);

  if (_appStateSub) _appStateSub.remove();
  _appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") tryFlush();
  });
}

export function stopNetSync(): void {
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_appStateSub) { _appStateSub.remove(); _appStateSub = null; }
}
