import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DatasetList } from "@/components/DatasetList";
import { FilterBuilder } from "@/components/FilterBuilder";
import { PreviewTable } from "@/components/PreviewTable";
import { DownloadBar } from "@/components/DownloadBar";
import { authEnabled } from "@/auth/authConfig";
import { UserMenu } from "@/auth/UserMenu";
import { useDatasets } from "@/hooks/useDatasets";
import { useDatasetDetail } from "@/hooks/useDatasetDetail";
import {
  changeSheet,
  deleteDataset,
  downloadDataset,
  previewDataset,
  uploadFile,
} from "@/services/datasets";
import { errorMessage, formatNumber, saveBlob } from "@/lib/utils";
import type {
  DatasetSummary,
  DownloadFormat,
  FilterGroup,
  PreviewResponse,
  SortSpec,
} from "@/types";

const PAGE_SIZE = 100;

export function WorkspacePage() {
  const { datasets, loading, error, refresh } = useDatasets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detail, loading: detailLoading, error: detailError, reload } = useDatasetDetail(selectedId);

  // Árbol de filtros aplicado; null = sin filtro (todas las filas).
  const [appliedFilter, setAppliedFilter] = useState<FilterGroup | null>(null);
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Deselecciona si el dataset activo desaparece de la lista.
  useEffect(() => {
    if (selectedId && !datasets.some((dataset) => dataset.id === selectedId)) {
      setSelectedId(null);
    }
  }, [datasets, selectedId]);

  const datasetReady = detail?.status === "ready";

  // Carga la vista previa cuando el dataset está listo (filtro null = todas las filas).
  useEffect(() => {
    if (!selectedId || !datasetReady) return;
    let active = true;
    setPreviewLoading(true);
    previewDataset(selectedId, {
      filter: appliedFilter,
      select: [],
      sort: sort ? [sort] : [],
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
  }, [selectedId, appliedFilter, sort, offset, datasetReady]);

  function handleSelect(dataset: DatasetSummary) {
    setSelectedId(dataset.id);
    setAppliedFilter(null); // vista completa inicial (sin filtro)
    setSort(null);
    setOffset(0);
    setPreview(null);
    setActionError(null);
  }

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setActionError(null);
      try {
        for (const file of files) {
          setUploadProgress(0);
          await uploadFile(file, setUploadProgress);
        }
        await refresh();
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setUploading(false);
        setUploadProgress(null);
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

  function handleApply(filter: FilterGroup | null) {
    setAppliedFilter(filter);
    setOffset(0);
  }

  // Ciclo de orden al clicar una columna: asc -> desc -> sin orden.
  function handleSort(column: string) {
    setOffset(0);
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  }

  async function handleSheetChange(sheet: string) {
    if (!selectedId) return;
    setActionError(null);
    try {
      await changeSheet(selectedId, sheet);
      await reload();
      // La hoja nueva puede tener otras columnas: reiniciamos filtro/orden.
      setAppliedFilter(null);
      setSort(null);
      setOffset(0);
      setPreview(null);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function handleDownload(format: DownloadFormat) {
    if (!selectedId) return;
    setDownloading(true);
    setActionError(null);
    try {
      const file = await downloadDataset(selectedId, {
        filter: appliedFilter,
        select: [],
        sort: sort ? [sort] : [],
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Encabezado fijo (no se desplaza) */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">DataFilter</h1>
          <p className="text-xs text-slate-500">
            Sube archivos grandes, filtra por columnas y descarga solo el resultado.
          </p>
        </div>
        {authEnabled ? <UserMenu /> : null}
      </header>

      {actionError ? (
        <div className="shrink-0 px-4 pt-3">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      {/* Zona principal: en escritorio queda fija y cada columna scrollea por dentro. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:overflow-hidden">
        <div className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[360px_1fr]">
          {/* Columna izquierda: subir + lista */}
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
            <Card className="shrink-0">
              <CardBody>
                <UploadDropzone onUpload={handleUpload} busy={uploading} progress={uploadProgress} />
              </CardBody>
            </Card>
            <Card className="flex h-[50vh] min-h-0 flex-col lg:h-auto lg:flex-1">
              <CardHeader title="Tus archivos" description="Selecciona uno listo para filtrar" />
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                <DatasetList
                  datasets={datasets}
                  selectedId={selectedId}
                  loading={loading}
                  error={error}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                />
              </div>
            </Card>
          </div>

          {/* Columna derecha: filtros fijos + preview que scrollea + descarga */}
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
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
                <Card className="shrink-0">
                  <CardHeader
                    title="Filtros"
                    description={`${detail.columns.length} columnas · ${
                      detail.row_count != null ? formatNumber(detail.row_count) : "?"
                    } filas`}
                  />
                  <CardBody className="thin-scroll max-h-[42vh] space-y-3 overflow-y-auto">
                    {detail.sheets.length > 1 ? (
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Label htmlFor="sheet">Hoja de Excel</Label>
                        <Select
                          id="sheet"
                          className="h-8 w-48"
                          value={detail.active_sheet ?? ""}
                          disabled={detail.status !== "ready"}
                          onChange={(event) => handleSheetChange(event.target.value)}
                        >
                          {detail.sheets.map((sheetName) => (
                            <option key={sheetName} value={sheetName}>
                              {sheetName}
                            </option>
                          ))}
                        </Select>
                        {detail.status !== "ready" ? <Spinner className="h-4 w-4" /> : null}
                      </div>
                    ) : null}
                    <FilterBuilder
                      key={`${detail.id}-${detail.active_sheet ?? ""}`}
                      datasetId={detail.id}
                      columns={detail.columns}
                      applying={previewLoading}
                      onApply={handleApply}
                    />
                  </CardBody>
                </Card>

                <Card className="flex h-[70vh] min-h-0 flex-col lg:h-auto lg:flex-1">
                  <CardHeader title="Vista previa" />
                  <CardBody className="flex min-h-0 flex-1 flex-col">
                    <PreviewTable
                      preview={preview}
                      loading={previewLoading}
                      loadingLabel={
                        appliedFilter
                          ? "Aplicando filtros…"
                          : "Cargando archivo… los archivos grandes pueden tardar unos segundos."
                      }
                      error={previewError}
                      sort={sort}
                      onSort={handleSort}
                      onPageChange={setOffset}
                    />
                  </CardBody>
                </Card>

                <Card className="shrink-0">
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
    </div>
  );
}
