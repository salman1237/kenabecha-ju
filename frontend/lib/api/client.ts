const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  /** Stable machine-readable code from the API, when it sends one. The UI
   *  translates this; `message` stays as the server's English text so there
   *  is always something to fall back on. */
  code?: string;

  constructor(status: number, detail: unknown, code?: string) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

function extractMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join(", ");
  }
  return "Something went wrong";
}

function doFetch(path: string, options: RequestInit): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
}

// Access tokens are short-lived (15min); refresh_token is the long-lived
// (30 day) cookie that's supposed to make sessions durable. Without this,
// any tab left open past 15 minutes would silently 401 on its next request
// — e.g. a listing form filled out slowly, or reopened after a break.
//
// Concurrent 401s share one in-flight refresh rather than each calling
// /auth/refresh themselves: the backend rotates the refresh token on every
// use and treats reuse of an already-rotated one as theft, revoking the
// whole session — so two parallel refresh calls would log the user out.
// This uses a bare fetch (not apiFetch) so it can never recurse into this
// same 401-handling path.
let refreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401 && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(path, options);
    }
  }

  if (!res.ok) {
    let detail: unknown = res.statusText;
    let code: string | undefined;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, extractMessage(detail), code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
