import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DatasetList } from "@/components/DatasetList";
import { FilterBuilder } from "@/components/FilterBuilder";
import { PreviewTable } from "@/components/PreviewTable";
import { DownloadBar } from "@/components/DownloadBar";
import { useDatasets } from "@/hooks/useDatasets";
import { useDatasetDetail } from "@/hooks/useDatasetDetail";
import {
  deleteDataset,
  downloadDataset,
  previewDataset,
  uploadFiles,
} from "@/services/datasets";
import { errorMessage, formatNumber, saveBlob } from "@/lib/utils";
import type {
  Combinator,
  DatasetSummary,
  DownloadFormat,
  FilterCondition,
  PreviewResponse,
} from "@/types";

const PAGE_SIZE = 100;

interface AppliedFilter {
  conditions: FilterCondition[];
  combinator: Combinator;
}

export function WorkspacePage() {
  const { datasets, loading, error, refresh } = useDatasets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detail, loading: detailLoading, error: detailError } = useDatasetDetail(selectedId);

  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter | null>(null);
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Deselecciona si el dataset activo desaparece de la lista.
  useEffect(() => {
    if (selectedId && !datasets.some((dataset) => dataset.id === selectedId)) {
      setSelectedId(null);
    }
  }, [datasets, selectedId]);

  // Carga la vista previa cuando hay filtro aplicado o cambia de página.
  useEffect(() => {
    if (!selectedId || !appliedFilter) return;
    let active = true;
    setPreviewLoading(true);
    previewDataset(selectedId, {
      ...appliedFilter,
      select: [],
      sort: [],
      limit: PAGE_SIZE,
      offset,
    })
      .then((result) => {
        if (active) {
          setPreview(result);
          setPreviewError(null);
        }
      })
      .catch((err) => {
        if (active) setPreviewError(errorMessage(err));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, appliedFilter, offset]);

  function handleSelect(dataset: DatasetSummary) {
    setSelectedId(dataset.id);
    setAppliedFilter({ conditions: [], combinator: "and" }); // vista completa inicial
    setOffset(0);
    setPreview(null);
    setActionError(null);
  }

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setActionError(null);
      try {
        await uploadFiles(files);
        await refresh();
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    },
    [refresh],
  );

  async function handleDelete(dataset: DatasetSummary) {
    setActionError(null);
    try {
      await deleteDataset(dataset.id);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function handleApply(conditions: FilterCondition[], combinator: Combinator) {
    setAppliedFilter({ conditions, combinator });
    setOffset(0);
  }

  async function handleDownload(format: DownloadFormat) {
    if (!selectedId || !appliedFilter) return;
    setDownloading(true);
    setActionError(null);
    try {
      const file = await downloadDataset(selectedId, {
        ...appliedFilter,
        select: [],
        sort: [],
        format,
      });
      saveBlob(file.blob, file.filename);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">DataFilter</h1>
        <p className="text-sm text-slate-500">
          Sube archivos grandes, filtra por columnas y descarga solo el resultado.
        </p>
      </header>

      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Columna izquierda: subir + lista */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <UploadDropzone onUpload={handleUpload} busy={uploading} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Tus archivos" description="Selecciona uno listo para filtrar" />
            <DatasetList
              datasets={datasets}
              selectedId={selectedId}
              loading={loading}
              error={error}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          </Card>
        </div>

        {/* Columna derecha: filtros + preview + descarga */}
        <div className="space-y-4">
          {!selectedId ? (
            <Card>
              <CardBody>
                <p className="py-10 text-center text-sm text-slate-500">
                  Selecciona un archivo de la izquierda para empezar a filtrar.
                </p>
              </CardBody>
            </Card>
          ) : detailLoading ? (
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
                  <Spinner /> Cargando esquema…
                </div>
              </CardBody>
            </Card>
          ) : detailError ? (
            <Card>
              <CardBody>
                <ErrorBanner message={detailError} />
              </CardBody>
            </Card>
          ) : detail ? (
            <>
              <Card>
                <CardHeader
                  title="Filtros"
                  description={`${detail.columns.length} columnas · ${
                    detail.row_count != null ? formatNumber(detail.row_count) : "?"
                  } filas`}
                />
                <CardBody>
                  <FilterBuilder
                    key={detail.id}
                    columns={detail.columns}
                    applying={previewLoading}
                    onApply={handleApply}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Vista previa" />
                <CardBody>
                  <PreviewTable
                    preview={preview}
                    loading={previewLoading}
                    error={previewError}
                    onPageChange={setOffset}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <DownloadBar
                    totalMatched={preview?.total_matched ?? null}
                    downloading={downloading}
                    onDownload={handleDownload}
                  />
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
