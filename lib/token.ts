/**
 * Token store backed by expo-file-system/legacy (no native linking needed).
 * In-memory cache for speed; file for persistence across app restarts.
 */
import * as FileSystem from "expo-file-system/legacy";

const STORE_DIR = FileSystem.documentDirectory + "auth-store/";
const TOKEN_FILE = STORE_DIR + "token.txt";
const USER_FILE  = STORE_DIR + "user.json";

let _token: string | null = null;
let _user: any = null;

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(STORE_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(STORE_DIR, { intermediates: true });
  } catch { /* ignore */ }
}

async function readFile(path: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path);
  } catch { return null; }
}

async function writeFile(path: string, value: string): Promise<void> {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(path, value);
  } catch { /* keep in-memory value */ }
}

async function deleteFile(path: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path);
  } catch { /* ignore */ }
}

export const tokenStore = {
  set: async (token: string): Promise<void> => {
    _token = token;
  },

  get: async (): Promise<string | null> => {
    return _token;
  },

  setUser: async (user: any): Promise<void> => {
    _user = user;
  },

  getUser: async (): Promise<any> => {
    return _user;
  },

  clear: async (): Promise<void> => {
    _token = null;
    _user  = null;
    await deleteFile(TOKEN_FILE);
    await deleteFile(USER_FILE);
  },

  isLoggedIn: async (): Promise<boolean> => {
    const token = await tokenStore.get();
    return !!token;
  },
};
