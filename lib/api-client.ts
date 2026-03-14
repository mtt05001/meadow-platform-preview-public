/** Client-side fetch wrapper for React Query */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Typed fetch wrapper. Throws ApiError on non-2xx responses.
 * Automatically sets JSON headers when body is provided.
 */
export async function apiFetch<T>(
  url: string,
  options?: FetchOptions,
): Promise<T> {
  const isBodyObject =
    options?.body !== undefined &&
    options.body !== null &&
    typeof options.body === "object" &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof ArrayBuffer);

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(isBodyObject ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
    body: isBodyObject ? JSON.stringify(options.body) : (options?.body as BodyInit),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      (data as { error?: string }).error || res.statusText,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}
