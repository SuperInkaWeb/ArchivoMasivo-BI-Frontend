/** Servicio de datasets: encapsula todas las llamadas al backend. */
import {
  API_BASE_URL,
  deleteResource,
  getAuthToken,
  getJson,
  postForFile,
  postJson,
  type DownloadedFile,
} from "@/lib/api";
import type {
  ComputeDownloadRequest,
  ComputeRequest,
  ComputeSaveRequest,
  ColumnStats,
  DatasetDetail,
  DatasetSummary,
  DedupeDownloadRequest,
  DedupeRequest,
  DedupeResponse,
  DedupeSaveRequest,
  DistinctValues,
  StatsRequest,
  DownloadRequest,
  PivotDownloadRequest,
  PivotRequest,
  PivotResponse,
  PivotSaveRequest,
  PreviewRequest,
  PreviewResponse,
  ReplaceDownloadRequest,
  ReplaceRequest,
  ReplaceSaveRequest,
  UploadTicket,
} from "@/types";

const UPLOAD_CONTENT_TYPE = "application/octet-stream";

/** Sube un archivo en dos pasos: pide URL, sube (con progreso) y confirma. */
export async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<DatasetSummary> {
  const ticket = await postJson<UploadTicket>("/datasets/upload-url", { filename: file.name });
  await putWithProgress(ticket, file, onProgress);
  return postJson<DatasetSummary>(`/datasets/${ticket.dataset.id}/uploaded`, {});
}

/** PUT del archivo con barra de progreso (a R2 directo o al backend en local). */
async function putWithProgress(
  ticket: UploadTicket,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const url = ticket.direct_to_storage ? ticket.upload_url : `${API_BASE_URL}${ticket.upload_url}`;
  // R2 usa URL prefirmada (sin token); el endpoint local del backend sí requiere token.
  const token = ticket.direct_to_storage ? null : await getAuthToken();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", UPLOAD_CONTENT_TYPE);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`La subida falló (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error("Fallo de red durante la subida"));
    xhr.send(file);
  });
}

export function listDatasets(): Promise<DatasetSummary[]> {
  return getJson<DatasetSummary[]>("/datasets");
}

export function getDataset(datasetId: string): Promise<DatasetDetail> {
  return getJson<DatasetDetail>(`/datasets/${datasetId}`);
}

export function deleteDataset(datasetId: string): Promise<void> {
  return deleteResource(`/datasets/${datasetId}`);
}

export function previewDataset(datasetId: string, request: PreviewRequest): Promise<PreviewResponse> {
  // Solo lectura: reintenta ante fallos de red transitorios (archivos grandes en frío).
  return postJson<PreviewResponse>(`/datasets/${datasetId}/preview`, request, { retry: true });
}

export function downloadDataset(datasetId: string, request: DownloadRequest): Promise<DownloadedFile> {
  return postForFile(`/datasets/${datasetId}/download`, request, `filtrado.${request.format}`);
}

export function columnValues(
  datasetId: string,
  column: string,
  search?: string,
): Promise<DistinctValues> {
  const params = new URLSearchParams({ column });
  if (search) params.set("search", search);
  return getJson<DistinctValues>(`/datasets/${datasetId}/values?${params.toString()}`);
}

export function changeSheet(datasetId: string, sheet: string): Promise<DatasetDetail> {
  return postJson<DatasetDetail>(`/datasets/${datasetId}/sheet`, { sheet });
}

/** Ejecuta un pivote y devuelve el reporte (solo lectura: se reintenta ante fallo de red). */
export function pivotDataset(datasetId: string, request: PivotRequest): Promise<PivotResponse> {
  return postJson<PivotResponse>(`/datasets/${datasetId}/pivot`, request, { retry: true });
}

/** Guarda el pivote como un dataset nuevo (se materializa en segundo plano). */
export function savePivot(datasetId: string, request: PivotSaveRequest): Promise<DatasetSummary> {
  return postJson<DatasetSummary>(`/datasets/${datasetId}/pivot/save`, request);
}

/** Descarga el reporte pivote completo como archivo (CSV/XLSX/TXT). */
export function downloadPivot(datasetId: string, request: PivotDownloadRequest): Promise<DownloadedFile> {
  return postForFile(`/datasets/${datasetId}/pivot/download`, request, `reporte.${request.format}`);
}

/** Aplica columnas calculadas y devuelve la vista (solo lectura: se reintenta ante fallo de red). */
export function computeDataset(datasetId: string, request: ComputeRequest): Promise<PreviewResponse> {
  return postJson<PreviewResponse>(`/datasets/${datasetId}/compute`, request, { retry: true });
}

/** Guarda las columnas calculadas como un dataset nuevo (se materializa en segundo plano). */
export function saveComputed(datasetId: string, request: ComputeSaveRequest): Promise<DatasetSummary> {
  return postJson<DatasetSummary>(`/datasets/${datasetId}/compute/save`, request);
}

/** Descarga todas las filas con las columnas calculadas como archivo (CSV/XLSX/TXT). */
export function downloadComputed(datasetId: string, request: ComputeDownloadRequest): Promise<DownloadedFile> {
  return postForFile(`/datasets/${datasetId}/compute/download`, request, `columnas.${request.format}`);
}

/** Aplica buscar-y-reemplazar y devuelve la vista (solo lectura: se reintenta ante fallo de red). */
export function replaceDataset(datasetId: string, request: ReplaceRequest): Promise<PreviewResponse> {
  return postJson<PreviewResponse>(`/datasets/${datasetId}/replace`, request, { retry: true });
}

/** Guarda las correcciones como un dataset nuevo (se materializa en segundo plano). */
export function saveReplace(datasetId: string, request: ReplaceSaveRequest): Promise<DatasetSummary> {
  return postJson<DatasetSummary>(`/datasets/${datasetId}/replace/save`, request);
}

/** Descarga todas las filas ya corregidas como archivo (CSV/XLSX/TXT). */
export function downloadReplace(datasetId: string, request: ReplaceDownloadRequest): Promise<DownloadedFile> {
  return postForFile(`/datasets/${datasetId}/replace/download`, request, `corregido.${request.format}`);
}

/** Quita duplicados y devuelve la vista (solo lectura: se reintenta ante fallo de red). */
export function dedupeDataset(datasetId: string, request: DedupeRequest): Promise<DedupeResponse> {
  return postJson<DedupeResponse>(`/datasets/${datasetId}/dedupe`, request, { retry: true });
}

/** Guarda el resultado sin duplicados como un dataset nuevo (se materializa en segundo plano). */
export function saveDedupe(datasetId: string, request: DedupeSaveRequest): Promise<DatasetSummary> {
  return postJson<DatasetSummary>(`/datasets/${datasetId}/dedupe/save`, request);
}

/** Descarga todas las filas sin duplicados como archivo (CSV/XLSX/TXT). */
export function downloadDedupe(datasetId: string, request: DedupeDownloadRequest): Promise<DownloadedFile> {
  return postForFile(`/datasets/${datasetId}/dedupe/download`, request, `sin_duplicados.${request.format}`);
}

/** Perfil descriptivo de una columna (solo lectura: se reintenta ante fallo de red). */
export function columnStats(datasetId: string, request: StatsRequest): Promise<ColumnStats> {
  return postJson<ColumnStats>(`/datasets/${datasetId}/stats`, request, { retry: true });
}
