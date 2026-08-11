let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(extractError(data));
    this.status = status;
    this.data = data;
  }
}

function extractError(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.values(record)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "خطایی در ارتباط با سامانه رخ داد.";
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return response.json();
  return response.text();
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf/", { credentials: "include" });
  const data = (await response.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function login(username: string, password: string) {
  const csrf = await ensureCsrf();
  const response = await fetch("/api/auth/login/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new ApiError(response.status, data);
  setAccessToken(data.access);
  return data.user;
}

export async function refreshAccess(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const csrf = await ensureCsrf();
      const response = await fetch("/api/auth/refresh/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
      });
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const data = await response.json();
      setAccessToken(data.access);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function logout() {
  const csrf = await ensureCsrf();
  await fetch("/api/auth/logout/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": csrf },
  });
  setAccessToken(null);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (response.status === 401 && retry && (await refreshAccess())) {
    return api<T>(path, options, false);
  }
  const data = await parseResponse(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const csrf = await ensureCsrf();
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: JSON.stringify(body),
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export async function downloadExcel(path: string, filename: string) {
  const request = async (retry: boolean): Promise<Response> => {
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const response = await fetch(`/api${path}`, {
      credentials: "include",
      headers,
    });
    if (response.status === 401 && retry && (await refreshAccess())) {
      return request(false);
    }
    return response;
  };
  const response = await request(true);
  if (!response.ok) throw new ApiError(response.status, await parseResponse(response));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
