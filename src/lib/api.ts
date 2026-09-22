/** Cliente HTTP mínimo hacia el backend. Centraliza base URL, token y errores. */

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** URL base del backend (para subidas por XHR que necesitan la URL absoluta). */
export const API_BASE_URL = BASE_URL;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Token de autenticación: la capa de auth registra un proveedor de token que
// estas funciones consultan antes de cada petición. Así api.ts no depende de Auth0.
// ---------------------------------------------------------------------------
type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

/** Devuelve el token actual (o null). Para llamadas por XHR fuera de fetch. */
export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (!tokenGetter) return {};
  try {
    const token = await tokenGetter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return (data && typeof data.message === "string" && data.message) || response.statusText;
  } catch {
    return response.statusText || "Error de red";
  }
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }
  return response;
}

// ---------------------------------------------------------------------------
// Reintento ante fallos de red transitorios (p. ej. "Failed to fetch" cuando la
// conexión se cae durante la primera lectura en frío de un archivo grande).
// ---------------------------------------------------------------------------
const NETWORK_RETRIES = 2; // reintentos extra tras el intento inicial
const RETRY_BASE_DELAY_MS = 600; // backoff lineal entre reintentos

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `fetch` que reintenta SOLO cuando la propia llamada lanza (error de red: la
 * petición no llegó a completarse). No reintenta respuestas HTTP ya recibidas
 * (4xx/5xx): son deterministas y podrían corresponder a operaciones no idempotentes.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (networkError) {
      lastError = networkError;
      if (attempt < NETWORK_RETRIES) await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

export async function getJson<T>(path: string): Promise<T> {
  // Los GET son idempotentes: seguro reintentar ante caída de red.
  const response = await ensureOk(
    await fetchWithRetry(`${BASE_URL}${path}`, { headers: await authHeader() }),
  );
  return response.json() as Promise<T>;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: { retry?: boolean },
): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  };
  // `retry` solo debe activarse en POST de solo lectura (sin efectos secundarios).
  const request = options?.retry
    ? fetchWithRetry(`${BASE_URL}${path}`, init)
    : fetch(`${BASE_URL}${path}`, init);
  const response = await ensureOk(await request);
  return response.json() as Promise<T>;
}

export async function deleteResource(path: string): Promise<void> {
  await ensureOk(
    await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: await authHeader() }),
  );
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** POST que devuelve un archivo binario; extrae el nombre del Content-Disposition. */
export async function postForFile(path: string, body: unknown, fallbackName: string): Promise<DownloadedFile> {
  const response = await ensureOk(
    await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(body),
    }),
  );
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  return { blob: await response.blob(), filename };
}
