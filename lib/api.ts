import { tokenStore } from "@/lib/token";

const BASE_URL = "https://darkseagreen-meerkat-296232.hostingersite.com/api/v1";

const ASSET_BASE = "https://darkseagreen-meerkat-296232.hostingersite.com";

/** Converts a stored path like "project-logos/abc.png" to a full URL */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_BASE}/storage/${path}`;
}

export function setAuthToken(_token: string) {}

async function buildHeaders(
  isFormData = false,
  extra?: Record<string, string>,
) {
  const token = await tokenStore.get();
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    Accept: "application/json",
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

const TIMEOUT_MS = 10_000; // 10 seconds

function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

const api = {
  post: async (url: string, body: any) => {
    const isFormData = body instanceof FormData;
    const headers = await buildHeaders(isFormData);
    const finalUrl = `${BASE_URL}${url}`;
    console.log("POST URL:", finalUrl);

    const response = await fetchWithTimeout(finalUrl, {
      method: "POST",
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });
    return handleResponse(response);
  },
  get: async (url: string) => {
    const headers = await buildHeaders();
    const finalUrl = `${BASE_URL}${url}`;
    console.log("GET URL:", finalUrl);

    const response = await fetchWithTimeout(finalUrl, {
      method: "GET",
      headers,
    });
    return handleResponse(response);
  },
  put: async (url: string, body: any) => {
    const headers = await buildHeaders();
    const finalUrl = `${BASE_URL}${url}`;
    console.log("PUT URL:", finalUrl);

    const response = await fetchWithTimeout(finalUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  delete: async (url: string) => {
    const headers = await buildHeaders();
    const finalUrl = `${BASE_URL}${url}`;
    console.log("DELETE URL:", finalUrl);

    const response = await fetchWithTimeout(finalUrl, {
      method: "DELETE",
      headers,
    });
    return handleResponse(response);
  },
};

export default api;
