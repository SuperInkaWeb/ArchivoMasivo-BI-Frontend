import { twMerge } from "tailwind-merge";

/** Une clases condicionalmente resolviendo conflictos de Tailwind (gana la última). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}

/** Formatea bytes a una unidad legible. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Formatea un entero con separadores de miles. */
export function formatNumber(value: number): string {
  return value.toLocaleString("es-PE");
}

/**
 * Limpia el ruido de coma flotante al mostrar un número (683696.2599999998 -> 683696.26)
 * sin alterar enteros ni decimales legítimos. No cambia el dato, solo su presentación.
 */
export function cleanNumber(value: number): string {
  if (!Number.isFinite(value) || Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(12)));
}

/** Extrae un mensaje legible de un error desconocido. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Dispara la descarga de un Blob en el navegador. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
