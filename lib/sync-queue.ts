/**
 * Offline submission queue.
 * When the network is unavailable, teardown submissions are saved here
 * and automatically retried the next time the app comes online.
 */
import * as FileSystem from "expo-file-system/legacy";

import api from "./api";

const QUEUE_FILE = `${FileSystem.documentDirectory}sync_queue.json`;

export type QueueEntry = {
  id: string;
  fields: Record<string, string>;
  photoPaths: Record<string, string>;
  draftDir: string;
  poleDraftDir: string;
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

/**
 * Try to submit every queued entry.
 * Called on app start (inside prefetchAll flow).
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

      // Success — clean up local drafts
      await FileSystem.deleteAsync(entry.draftDir, { idempotent: true }).catch(() => {});
      await FileSystem.deleteAsync(entry.poleDraftDir, { idempotent: true }).catch(() => {});
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // Already submitted on the server — clean up and discard
        await FileSystem.deleteAsync(entry.draftDir, { idempotent: true }).catch(() => {});
        await FileSystem.deleteAsync(entry.poleDraftDir, { idempotent: true }).catch(() => {});
      } else {
        // Network error or other server error — keep for next retry
        remaining.push(entry);
      }
    }
  }

  await writeQueue(remaining);
}
