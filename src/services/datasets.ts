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
  DatasetDetail,
  DatasetSummary,
  DistinctValues,
  DownloadRequest,
  PreviewRequest,
  PreviewResponse,
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
  return postJson<PreviewResponse>(`/datasets/${datasetId}/preview`, request);
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
