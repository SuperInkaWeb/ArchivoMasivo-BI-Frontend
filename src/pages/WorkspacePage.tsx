import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DatasetList } from "@/components/DatasetList";
import { FilterBuilder } from "@/components/FilterBuilder";
import { SheetGrid } from "@/components/SheetGrid";
import { DataTable } from "@/components/DataTable";
import { PivotView } from "@/components/PivotView";
import { ComputeView } from "@/components/ComputeView";
import { ReplaceView } from "@/components/ReplaceView";
import { Ribbon, type WorkspaceMode } from "@/components/Ribbon";
import { Drawer } from "@/components/Drawer";
import { DownloadBar } from "@/components/DownloadBar";
import { authEnabled } from "@/auth/authConfig";
import { UserMenu } from "@/auth/UserMenu";
import { useDatasets } from "@/hooks/useDatasets";
import { useDatasetDetail } from "@/hooks/useDatasetDetail";
import { changeSheet, deleteDataset, downloadDataset, uploadFile } from "@/services/datasets";
import { errorMessage, formatNumber, saveBlob } from "@/lib/utils";
import type {
  DatasetSummary,
  Delimiter,
  DownloadFormat,
  FilterGroup,
  PreviewResponse,
  SortSpec,
} from "@/types";

type OriginTab = "uploaded" | "derived";

const TOOL_TITLES: Record<WorkspaceMode, { title: string; description: string }> = {
  filter: { title: "Filtrar", description: "Incluye solo las filas que cumplan tus condiciones." },
  pivot: { title: "Tabla dinámica", description: "Agrupa, calcula métricas y guarda el resumen como archivo." },
  compute: { title: "Columnas calculadas", description: "Crea columnas nuevas (unir, cálculos, fechas, SI)." },
  replace: { title: "Buscar y reemplazar", description: "Corrige valores por columna con reglas." },
};

export function WorkspacePage() {
  const { datasets, loading, error, refresh } = useDatasets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detail, loading: detailLoading, error: detailError, reload } = useDatasetDetail(selectedId);

  // Árbol de filtros aplicado; null = sin filtro (todas las filas).
  const [appliedFilter, setAppliedFilter] = useState<FilterGroup | null>(null);
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Búsqueda global (input inmediato + valor con debounce que llega al backend).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Resultado de una herramienta (pivote/columnas/reemplazar) mostrado al centro.
  const [toolResult, setToolResult] = useState<PreviewResponse | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolFetcher, setToolFetcher] = useState<((offset: number) => Promise<PreviewResponse>) | null>(null);
  const [toolCountLabel, setToolCountLabel] = useState("filas");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pestaña de la lista (Originales / Reportes).
  const [originTab, setOriginTab] = useState<OriginTab>("uploaded");
  // Herramienta abierta en el panel lateral; null = ninguna (solo la tabla al centro).
  const [activeTool, setActiveTool] = useState<WorkspaceMode | null>(null);
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
    setSearchInput("");
    setSearch("");
    setActionError(null);
    setNotice(null);
    setActiveTool(null); // abre solo con la tabla al centro
    clearToolResult();
    setSidebarOpen(false); // al abrir un archivo, colapsa la lista para ver los datos en grande
  }

  function clearToolResult() {
    setToolResult(null);
    setToolLoading(false);
    setToolFetcher(null);
  }

  function toggleTool(tool: WorkspaceMode) {
    clearToolResult(); // el resultado anterior no aplica a otra herramienta
    setActiveTool((current) => (current === tool ? null : tool));
  }

  function pageTool(fetcher: (offset: number) => Promise<PreviewResponse>, offset: number) {
    setToolLoading(true);
    setActionError(null);
    fetcher(offset)
      .then((response) => setToolResult(response))
      .catch((err) => setActionError(errorMessage(err)))
      .finally(() => setToolLoading(false));
  }

  // La herramienta arma el fetcher (con su config); aquí se ejecuta y se muestra al centro.
  function runToolPreview(fetcher: (offset: number) => Promise<PreviewResponse>, countLabel = "filas") {
    setToolFetcher(() => fetcher);
    setToolCountLabel(countLabel);
    pageTool(fetcher, 0);
  }

  async function handleDerivedSaved(name: string) {
    await refresh();
    setActiveTool(null); // cierra el panel para volver a la tabla
    setOriginTab("derived"); // deja lista la pestaña de Reportes
    setNotice(`Guardando "${name}"… aparecerá en Reportes (ábrelo con ☰) cuando esté listo.`);
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
    setActiveTool(null); // al aplicar, cierra el panel para ver el resultado en grande
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
      clearToolResult();
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
        ...(search.trim() ? { search: search.trim() } : {}),
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
              <div className="relative flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Ribbon mode={activeTool} onChange={toggleTool} />
                  <Input
                    type="search"
                    className="ml-auto h-9 w-64"
                    placeholder="Buscar en todo el archivo…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>

                <Card className="flex h-[70vh] min-h-0 flex-col lg:h-auto lg:flex-1">
                  {toolResult || toolLoading ? (
                    <>
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">Vista previa del resultado</h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {activeTool ? TOOL_TITLES[activeTool].title : ""} · guarda o descarga desde el panel
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearToolResult}
                          className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Volver a los datos
                        </button>
                      </div>
                      <CardBody className="flex min-h-0 flex-1 flex-col">
                        {toolResult ? (
                          <DataTable
                            columns={toolResult.columns}
                            rows={toolResult.rows}
                            total={toolResult.total_matched}
                            limit={toolResult.limit}
                            offset={toolResult.offset}
                            loading={toolLoading}
                            countLabel={toolCountLabel}
                            onPageChange={(offset) => toolFetcher && pageTool(toolFetcher, offset)}
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                            <Spinner /> Generando…
                          </div>
                        )}
                      </CardBody>
                    </>
                  ) : (
                    <>
                      <CardHeader
                        title={detail.original_filename}
                        description={`${detail.columns.length} columnas · ${
                          detail.row_count != null ? formatNumber(detail.row_count) : "?"
                        } filas${appliedFilter ? " · filtro activo" : ""}`}
                      />
                      <CardBody className="flex min-h-0 flex-1 flex-col">
                        <SheetGrid
                          key={`${detail.id}-${detail.active_sheet ?? ""}`}
                          datasetId={detail.id}
                          filter={appliedFilter}
                          sort={sort}
                          ready={datasetReady}
                          search={search}
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
                    </>
                  )}
                </Card>

                {activeTool ? (
                  <Drawer
                    title={TOOL_TITLES[activeTool].title}
                    description={TOOL_TITLES[activeTool].description}
                    onClose={() => setActiveTool(null)}
                  >
                    {activeTool === "filter" ? (
                      <div className="space-y-3">
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
                      </div>
                    ) : activeTool === "pivot" ? (
                      <PivotView
                        dataset={detail}
                        busy={toolLoading}
                        onPreview={runToolPreview}
                        onSaved={handleDerivedSaved}
                      />
                    ) : activeTool === "compute" ? (
                      <ComputeView
                        dataset={detail}
                        busy={toolLoading}
                        onPreview={runToolPreview}
                        onSaved={handleDerivedSaved}
                      />
                    ) : (
                      <ReplaceView
                        dataset={detail}
                        busy={toolLoading}
                        onPreview={runToolPreview}
                        onSaved={handleDerivedSaved}
                      />
                    )}
                  </Drawer>
                ) : null}
              </div>
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
