import { tokenStore } from "@/lib/token";

// ngrok URL changes each session — update this when you restart ngrok
const BASE_URL =
  "https://disguisedly-enarthrodial-kristi.ngrok-free.dev/api/v1";

const ASSET_BASE = BASE_URL.replace("/v1", "");

/** Converts a stored path like "project-logos/abc.png" to a full URL via the file proxy */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${ASSET_BASE}/files/${path}`;
}

// Kept for login.tsx compatibility — tokenStore is the source of truth
export function setAuthToken(_token: string) {}

async function buildHeaders(
  isFormData = false,
  extra?: Record<string, string>,
) {
  const token = await tokenStore.get();
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    Accept: "application/json",
    "ngrok-skip-browser-warning": "1",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(response: Response) {
  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const err: any = new Error(data?.message ?? "Request failed");
    err.response = { status: response.status, data };
    throw err;
  }

  return { data };
}

const api = {
  post: async (url: string, body: any) => {
    const isFormData = body instanceof FormData;
    const headers = await buildHeaders(isFormData);
    const response = await fetch(`${BASE_URL}${url}`, {
      method: "POST",
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });
    return handleResponse(response);
  },
  get: async (url: string) => {
    const headers = await buildHeaders();
    const response = await fetch(`${BASE_URL}${url}`, {
      method: "GET",
      headers,
    });
    return handleResponse(response);
  },
  put: async (url: string, body: any) => {
    const headers = await buildHeaders();
    const response = await fetch(`${BASE_URL}${url}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  delete: async (url: string) => {
    const headers = await buildHeaders();
    const response = await fetch(`${BASE_URL}${url}`, {
      method: "DELETE",
      headers,
    });
    return handleResponse(response);
  },
};

export default api;
