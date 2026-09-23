import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DatasetList } from "@/components/DatasetList";
import { FilterBuilder } from "@/components/FilterBuilder";
import { SheetGrid } from "@/components/SheetGrid";
import { PivotView } from "@/components/PivotView";
import { ComputeView } from "@/components/ComputeView";
import { ReplaceView } from "@/components/ReplaceView";
import { Ribbon } from "@/components/Ribbon";
import { DownloadBar } from "@/components/DownloadBar";
import { authEnabled } from "@/auth/authConfig";
import { UserMenu } from "@/auth/UserMenu";
import { useDatasets } from "@/hooks/useDatasets";
import { useDatasetDetail } from "@/hooks/useDatasetDetail";
import { changeSheet, deleteDataset, downloadDataset, uploadFile } from "@/services/datasets";
import { errorMessage, formatNumber, saveBlob } from "@/lib/utils";
import type { DatasetSummary, Delimiter, DownloadFormat, FilterGroup, SortSpec } from "@/types";

type RightMode = "filter" | "pivot" | "compute" | "replace";
type OriginTab = "uploaded" | "derived";

export function WorkspacePage() {
  const { datasets, loading, error, refresh } = useDatasets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detail, loading: detailLoading, error: detailError, reload } = useDatasetDetail(selectedId);

  // Árbol de filtros aplicado; null = sin filtro (todas las filas).
  const [appliedFilter, setAppliedFilter] = useState<FilterGroup | null>(null);
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pestaña de la lista (Originales / Reportes) y modo del panel derecho.
  const [originTab, setOriginTab] = useState<OriginTab>("uploaded");
  const [rightMode, setRightMode] = useState<RightMode>("filter");
  // Panel de filtros plegable: cerrado por defecto para que la cuadrícula ocupe más.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lista lateral colapsable: se pliega al abrir un archivo para dar todo el ancho.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isDerived = (dataset: DatasetSummary) => dataset.origin !== "uploaded";
  const visibleDatasets = datasets.filter((dataset) =>
    originTab === "uploaded" ? !isDerived(dataset) : isDerived(dataset),
  );
  const uploadedCount = datasets.filter((dataset) => !isDerived(dataset)).length;
  const derivedCount = datasets.filter(isDerived).length;

  // Deselecciona si el dataset activo desaparece de la lista.
  useEffect(() => {
    if (selectedId && !datasets.some((dataset) => dataset.id === selectedId)) {
      setSelectedId(null);
    }
  }, [datasets, selectedId]);

  const datasetReady = detail?.status === "ready";

  function handleSelect(dataset: DatasetSummary) {
    setSelectedId(dataset.id);
    setAppliedFilter(null); // vista completa inicial (sin filtro)
    setSort(null);
    setMatchedCount(null);
    setActionError(null);
    setNotice(null);
    setRightMode("filter");
    setSidebarOpen(false); // al abrir un archivo, colapsa la lista para ver los datos en grande
  }

  async function handleDerivedSaved(name: string) {
    await refresh();
    setOriginTab("derived"); // muestra el archivo derivado recién creado
    setNotice(`Guardando "${name}"… aparecerá en Reportes cuando esté listo.`);
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
    setFiltersOpen(false); // al aplicar, contrae para ver el resultado en grande
  }

  // Ciclo de orden al clicar una columna: asc -> desc -> sin orden.
  function handleSort(column: string) {
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
      setMatchedCount(null);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function handleDownload(format: DownloadFormat, delimiter?: Delimiter) {
    if (!selectedId) return;
    setDownloading(true);
    setActionError(null);
    try {
      const file = await downloadDataset(selectedId, {
        filter: appliedFilter,
        select: [],
        sort: sort ? [sort] : [],
        format,
        ...(format === "txt" && delimiter ? { delimiter } : {}),
      });
      saveBlob(file.blob, file.filename);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-300">
      {/* Encabezado fijo (no se desplaza) */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Ocultar panel de archivos" : "Mostrar panel de archivos"}
            title="Panel de archivos"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            ☰
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">DataFilter</h1>
            <p className="text-xs text-slate-500">
              Sube archivos grandes, filtra por columnas y descarga solo el resultado.
            </p>
          </div>
        </div>
        {authEnabled ? <UserMenu /> : null}
      </header>

      {actionError ? (
        <div className="shrink-0 px-4 pt-3">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      {notice ? (
        <div className="shrink-0 px-4 pt-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        </div>
      ) : null}

      {/* Zona principal: en escritorio queda fija y cada columna scrollea por dentro. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:overflow-hidden">
        <div
          className={
            "grid gap-4 lg:h-full lg:min-h-0 " +
            (sidebarOpen ? "lg:grid-cols-[360px_1fr]" : "lg:grid-cols-[1fr]")
          }
        >
          {/* Columna izquierda: subir + lista (colapsable) */}
          {sidebarOpen ? (
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
            <Card className="shrink-0">
              <CardBody>
                <UploadDropzone onUpload={handleUpload} busy={uploading} progress={uploadProgress} />
              </CardBody>
            </Card>
            <Card className="flex h-[50vh] min-h-0 flex-col lg:h-auto lg:flex-1">
              <div className="flex shrink-0 border-b border-slate-200">
                <TabButton
                  active={originTab === "uploaded"}
                  onClick={() => setOriginTab("uploaded")}
                >
                  Originales ({uploadedCount})
                </TabButton>
                <TabButton active={originTab === "derived"} onClick={() => setOriginTab("derived")}>
                  Reportes ({derivedCount})
                </TabButton>
              </div>
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                <DatasetList
                  datasets={visibleDatasets}
                  selectedId={selectedId}
                  loading={loading}
                  error={error}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                />
              </div>
            </Card>
          </div>
          ) : null}

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
                <Ribbon mode={rightMode} onChange={setRightMode} />

                {rightMode === "pivot" ? (
                  <Card className="flex min-h-0 flex-1 flex-col lg:h-auto">
                    <CardHeader
                      title="Tabla dinámica"
                      description="Agrupa, calcula métricas y guarda el resumen como un archivo nuevo."
                    />
                    <CardBody className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                      <PivotView dataset={detail} onSaved={handleDerivedSaved} />
                    </CardBody>
                  </Card>
                ) : rightMode === "compute" ? (
                  <Card className="flex min-h-0 flex-1 flex-col lg:h-auto">
                    <CardHeader
                      title="Columnas calculadas"
                      description="Crea columnas nuevas (unir texto, cálculos, fechas…) y guárdalas como un archivo nuevo."
                    />
                    <CardBody className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                      <ComputeView dataset={detail} onSaved={handleDerivedSaved} />
                    </CardBody>
                  </Card>
                ) : rightMode === "replace" ? (
                  <Card className="flex min-h-0 flex-1 flex-col lg:h-auto">
                    <CardHeader
                      title="Buscar y reemplazar"
                      description="Corrige valores por columna con reglas y guarda el archivo corregido."
                    />
                    <CardBody className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                      <ReplaceView dataset={detail} onSaved={handleDerivedSaved} />
                    </CardBody>
                  </Card>
                ) : (
                  <>
                    <Card className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setFiltersOpen((open) => !open)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-900">Filtros</span>
                          <span className="text-xs text-slate-500">
                            {detail.columns.length} columnas ·{" "}
                            {detail.row_count != null ? formatNumber(detail.row_count) : "?"} filas
                            {appliedFilter ? " · filtro activo" : ""}
                          </span>
                        </span>
                        <span className="text-xs font-medium text-emerald-700">
                          {filtersOpen ? "Ocultar ▲" : "Mostrar ▼"}
                        </span>
                      </button>
                      {filtersOpen ? (
                        <CardBody className="thin-scroll max-h-[38vh] space-y-3 overflow-y-auto pt-0">
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
                      ) : null}
                    </Card>

                    <Card className="flex h-[70vh] min-h-0 flex-col lg:h-auto lg:flex-1">
                      <CardHeader title="Vista previa" />
                      <CardBody className="flex min-h-0 flex-1 flex-col">
                        <SheetGrid
                          key={`${detail.id}-${detail.active_sheet ?? ""}`}
                          datasetId={detail.id}
                          filter={appliedFilter}
                          sort={sort}
                          ready={datasetReady}
                          onSort={handleSort}
                          onTotalChange={setMatchedCount}
                          onLoadingChange={setPreviewLoading}
                          loadingLabel={
                            appliedFilter
                              ? "Aplicando filtros…"
                              : "Cargando archivo… los archivos grandes pueden tardar unos segundos."
                          }
                        />
                      </CardBody>
                      <div className="shrink-0 border-t border-slate-200 px-4 py-3">
                        <DownloadBar
                          totalMatched={matchedCount}
                          downloading={downloading}
                          onDownload={handleDownload}
                        />
                      </div>
                    </Card>
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pestaña de la lista de archivos (Originales / Reportes). */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors " +
        (active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}
