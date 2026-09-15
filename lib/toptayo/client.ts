import "server-only";

const BASE_URL = process.env.TOPTAYO_API_BASE_URL ?? "https://toptayo.com";
const API_KEY = process.env.TOPTAYO_API_KEY;

export class ToptayoApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ToptayoApiError";
  }
}

type QueryParams = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: QueryParams) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function requireApiKey() {
  if (!API_KEY) {
    throw new ToptayoApiError(
      500,
      "TOPTAYO_API_KEY is not configured on the server.",
    );
  }
  return API_KEY;
}

async function throwForStatus(response: Response): Promise<never> {
  if (response.status === 401) {
    throw new ToptayoApiError(401, "TopTayo API key was rejected.");
  }
  if (response.status === 403) {
    throw new ToptayoApiError(403, "TopTayo rejected this request as forbidden.");
  }
  if (response.status === 404) {
    throw new ToptayoApiError(404, "TopTayo resource was not found.");
  }
  if (response.status === 400) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : "TopTayo rejected this request payload.";
    throw new ToptayoApiError(400, message);
  }
  throw new ToptayoApiError(
    response.status,
    `TopTayo API request failed with status ${response.status}.`,
  );
}

export async function toptayoFetch<T>(
  path: string,
  params?: QueryParams,
): Promise<T> {
  const apiKey = requireApiKey();
  const response = await fetch(buildUrl(path, params), {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) await throwForStatus(response);
  return (await response.json()) as T;
}

export async function toptayoPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const apiKey = requireApiKey();
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) await throwForStatus(response);
  return (await response.json()) as T;
}
