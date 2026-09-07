/** Servicio de datasets: encapsula todas las llamadas al backend. */
import {
  deleteResource,
  getJson,
  postForFile,
  postForm,
  postJson,
  type DownloadedFile,
} from "@/lib/api";
import type {
  DatasetDetail,
  DatasetSummary,
  DownloadRequest,
  PreviewRequest,
  PreviewResponse,
} from "@/types";

interface UploadResult {
  datasets: DatasetSummary[];
}

export async function uploadFiles(files: File[]): Promise<DatasetSummary[]> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const result = await postForm<UploadResult>("/datasets/upload", form);
  return result.datasets;
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
