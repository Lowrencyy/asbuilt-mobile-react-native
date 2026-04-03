/**
 * Offline submission queue.
 * When the network is unavailable, teardown submissions are saved here
 * and automatically retried the next time the app comes online.
 */
import * as FileSystem from "expo-file-system/legacy";

import api from "./api";
import { cacheSet } from "./cache";

const QUEUE_FILE = `${FileSystem.documentDirectory}sync_queue.json`;

export type QueueEntry = {
  id: string;
  fields: Record<string, string>;
  photoPaths: Record<string, string>;
  draftDir: string;
  poleDraftDir: string;
  fromPoleId?: string;
  nodeId?: string;
  poleAfterPath?: string; // path to delete from pole_drafts after success
  queuedAt: string;
};

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(QUEUE_FILE);
    return JSON.parse(raw) ?? [];
  } catch {
    return [];
  }
}

async function writeQueue(entries: QueueEntry[]): Promise<void> {
  await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(entries));
}

export async function queuePush(
  entry: Omit<QueueEntry, "id" | "queuedAt">,
): Promise<void> {
  const entries = await readQueue();
  entries.push({
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  });
  await writeQueue(entries);
}

export async function queueCount(): Promise<number> {
  const entries = await readQueue();
  return entries.length;
}

export async function queueReadAll(): Promise<QueueEntry[]> {
  return readQueue();
}

export async function queueRemove(id: string): Promise<void> {
  const entries = await readQueue();
  await writeQueue(entries.filter((e) => e.id !== id));
}

/**
 * Try to submit every queued entry.
 * Called by net-sync every 60 s (and on foreground).
 * Never throws — safe to fire-and-forget.
 */
export async function processSyncQueue(): Promise<void> {
  const entries = await readQueue();
  if (entries.length === 0) return;

  const remaining: QueueEntry[] = [];

  for (const entry of entries) {
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(entry.fields)) {
        form.append(key, value);
      }
      for (const [fieldName, uri] of Object.entries(entry.photoPaths)) {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          form.append(fieldName, {
            uri,
            name: `${fieldName}.jpg`,
            type: "image/jpeg",
          } as any);
        }
      }

      await api.post("/teardown-logs", form);

      // Success — bust caches and clean up teardown draft only
      await cacheSet("teardown_logs", null);
      if (entry.fromPoleId) {
        await cacheSet(`spans_pole_${entry.fromPoleId}`, null);
        // Mark pole as submitted — future spans skip re-uploading before/tag
        await cacheSet(`pole_submitted_${entry.fromPoleId}`, true);
      }
      if (entry.nodeId) {
        await cacheSet(`node_logs_${entry.nodeId}`, null);
      }
      await FileSystem.deleteAsync(entry.draftDir, { idempotent: true }).catch(() => {});
      // Delete the `after` from pole_drafts so pole-detail shows blank for next span
      if (entry.poleAfterPath) {
        await FileSystem.deleteAsync(entry.poleAfterPath, { idempotent: true }).catch(() => {});
      }
      // poleDraftDir kept intentionally — before/tag reused for other spans
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // Already submitted on the server — clean up teardown draft only
        await FileSystem.deleteAsync(entry.draftDir, { idempotent: true }).catch(() => {});
      } else {
        // Network error or other server error — keep for next retry
        remaining.push(entry);
      }
    }
  }

  await writeQueue(remaining);
}
