/** Cliente HTTP mínimo hacia el backend. Centraliza base URL, token y errores. */

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

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

export async function getJson<T>(path: string): Promise<T> {
  const response = await ensureOk(await fetch(`${BASE_URL}${path}`, { headers: await authHeader() }));
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await ensureOk(
    await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(body),
    }),
  );
  return response.json() as Promise<T>;
}

export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const response = await ensureOk(
    await fetch(`${BASE_URL}${path}`, { method: "POST", headers: await authHeader(), body: form }),
  );
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
