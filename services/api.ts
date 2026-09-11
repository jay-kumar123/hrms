"use client";

const DEFAULT_DEV_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItaHItYWRtaW4iLCJlbWFpbCI6ImFkbWluQGhvdGVsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlzU3VwZXJBZG1pbiI6dHJ1ZSwiaWF0IjoxNzg4OTY1NDMxLCJleHAiOjQ5NDI1NjU0MzF9.AQgcCfDXwelhWYzou90YINGcT5rv1TLK-gy0zbYpjus";

const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    return "http://127.0.0.1:5001";
  }
  return envUrl.replace(/\/$/, "");
};

const API_BASE = getApiBaseUrl();

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let token =
    typeof window !== "undefined" ? localStorage.getItem("pms_token") : null;
  if (!token) {
    token = DEFAULT_DEV_TOKEN;
    if (typeof window !== "undefined") {
      localStorage.setItem("pms_token", DEFAULT_DEV_TOKEN);
    }
  }

  const propertyId =
    typeof window !== "undefined" ? localStorage.getItem("pms_active_property") : null;
  let parsedPropertyId: string | undefined = "prop-shaw-hotel";
  if (propertyId) {
    try {
      const parsed = JSON.parse(propertyId) as { id?: string };
      if (parsed?.id) parsedPropertyId = parsed.id;
    } catch {
      parsedPropertyId = "prop-shaw-hotel";
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(parsedPropertyId ? { "X-Property-Id": parsedPropertyId } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
  } catch (networkError) {
    // Network offline / connection refused: Gracefully throw ApiError without unhandled TypeError
    throw new ApiError(
      `Backend is unreachable at ${API_BASE} (Server offline).`,
      503
    );
  }

  // If token was rejected/expired in browser session, retry once with fresh DEV_TOKEN
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.setItem("pms_token", DEFAULT_DEV_TOKEN);
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEFAULT_DEV_TOKEN}`,
          ...(parsedPropertyId ? { "X-Property-Id": parsedPropertyId } : {}),
          ...(options.headers || {}),
        },
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        `Backend is unreachable at ${API_BASE} (Server offline).`,
        503
      );
    }
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError("Invalid JSON response from API", res.status);
  }

  if (!res.ok || !json.success) {
    throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: "DELETE" }),
};

export const foPath = (segment: string) =>
  `/api/front-office${segment.startsWith("/") ? segment : `/${segment}`}`;

export const psPath = (segment: string) =>
  `/api/purchase-stores${segment.startsWith("/") ? segment : `/${segment}`}`;
