import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    /** Per-field messages from validation errors, keyed by field name. */
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; token?: string };

const FALLBACK = 'Something went wrong. Please try again.';

async function parse(res: Response) {
  return res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null;
}

/**
 * Small fetch wrapper for the Express API: JSON in/out, bearer token, typed errors.
 * A body defaults the method to POST. Error messages are written for end users.
 */
export async function api<T>(
  path: string,
  { body, token, headers, ...init }: RequestOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      method: init.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const data = await parse(res);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? FALLBACK, data?.details, data?.fields);
  }
  return data as T;
}

/** Uploads a photo (raw image body) and returns its public URL. */
export async function uploadImage(file: Blob, token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
      body: file,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  const data = await parse(res);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? FALLBACK);
  return (data as { url: string }).url;
}
