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
import { DedupeView } from "@/components/DedupeView";
import { Ribbon, type WorkspaceMode } from "@/components/Ribbon";
import { Drawer } from "@/components/Drawer";
import { DownloadBar } from "@/components/DownloadBar";
import { FormatPicker } from "@/components/FormatPicker";
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
  ResultFetcher,
  ResultSort,
  SortSpec,
  ToolPreviewOptions,
} from "@/types";

type OriginTab = "uploaded" | "derived";
type ToolExport = Pick<ToolPreviewOptions, "download" | "save">;

/** Cuenta las condiciones (hojas) de un árbol de filtro, para el resumen del chip. */
function countConditions(node: FilterGroup): number {
  return node.children.reduce(
    (total, child) => total + (child.type === "group" ? countConditions(child) : 1),
    0,
  );
}

const TOOL_TITLES: Record<WorkspaceMode, { title: string; description: string }> = {
  filter: { title: "Filtrar", description: "Incluye solo las filas que cumplan tus condiciones." },
  pivot: { title: "Tabla dinámica", description: "Agrupa, calcula métricas y guarda el resumen como archivo." },
  compute: { title: "Columnas calculadas", description: "Crea columnas nuevas (unir, cálculos, fechas, SI)." },
  replace: { title: "Buscar y reemplazar", description: "Corrige valores por columna con reglas." },
  dedupe: { title: "Quitar duplicados", description: "Elimina filas repetidas (por fila completa o por columnas clave)." },
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
  const [toolFetcher, setToolFetcher] = useState<ResultFetcher | null>(null);
  const [toolCountLabel, setToolCountLabel] = useState("filas");
  // Orden de la tabla de resultados (por encabezado); solo para herramientas que lo admiten.
  const [toolSortable, setToolSortable] = useState(false);
  const [resultSort, setResultSort] = useState<ResultSort | null>(null);
  // Acciones de exportar/guardar de la herramienta activa, para ofrecerlas junto al resultado.
  const [toolExport, setToolExport] = useState<ToolExport | null>(null);
  const [resultDownloading, setResultDownloading] = useState(false);
  const [resultSaving, setResultSaving] = useState(false);
  // Fuerza reiniciar el constructor de filtros al quitar el filtro desde el chip.
  const [filterResetKey, setFilterResetKey] = useState(0);

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
    setToolExport(null);
    setToolSortable(false);
    setResultSort(null);
  }

  function handleClearFilter() {
    setAppliedFilter(null);
    setFilterResetKey((key) => key + 1); // reinicia el constructor para que quede vacío
  }

  // Descarga/guarda el resultado mostrado al centro usando las acciones de la herramienta activa.
  async function handleResultDownload(format: DownloadFormat, delimiter?: Delimiter) {
    if (!toolExport) return;
    setResultDownloading(true);
    setActionError(null);
    try {
      await toolExport.download(format, delimiter);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setResultDownloading(false);
    }
  }

  async function handleResultSave() {
    if (!toolExport) return;
    setResultSaving(true);
    setActionError(null);
    try {
      await toolExport.save();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setResultSaving(false);
    }
  }

  function toggleTool(tool: WorkspaceMode) {
    clearToolResult(); // el resultado anterior no aplica a otra herramienta
    setActiveTool((current) => (current === tool ? null : tool));
  }

  function pageTool(fetcher: ResultFetcher, offset: number, sort: ResultSort | null) {
    setToolLoading(true);
    setActionError(null);
    fetcher(offset, sort)
      .then((response) => setToolResult(response))
      .catch((err) => setActionError(errorMessage(err)))
      .finally(() => setToolLoading(false));
  }

  // La herramienta arma el fetcher (con su config); aquí se ejecuta y se muestra al centro.
  // Además registra sus acciones de exportar/guardar para ofrecerlas junto al resultado.
  function runToolPreview(fetcher: ResultFetcher, options: ToolPreviewOptions) {
    setToolFetcher(() => fetcher);
    setToolCountLabel(options.countLabel ?? "filas");
    setToolSortable(options.sortable ?? false);
    setResultSort(null);
    setToolExport({ download: options.download, save: options.save });
    pageTool(fetcher, 0, null);
  }

  // Ciclo de orden al clicar un encabezado del resultado: asc -> desc -> sin orden.
  function handleResultSort(column: string) {
    const next: ResultSort | null =
      !resultSort || resultSort.column !== column
        ? { column, direction: "asc" }
        : resultSort.direction === "asc"
          ? { column, direction: "desc" }
          : null;
    setResultSort(next);
    if (toolFetcher) pageTool(toolFetcher, 0, next);
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

                  {detail.sheets.length > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="sheet-top" className="shrink-0">
                        Hoja
                      </Label>
                      <Select
                        id="sheet-top"
                        className="h-9 w-44"
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

                  {appliedFilter ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 py-1 pl-2.5 pr-1 text-xs text-emerald-800">
                      Filtro activo
                      <span className="text-emerald-600">
                        ({countConditions(appliedFilter)}
                        {matchedCount != null ? ` · ${formatNumber(matchedCount)} filas` : ""})
                      </span>
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        aria-label="Quitar filtro"
                        title="Quitar filtro"
                        className="rounded-full px-1 text-emerald-600 hover:bg-emerald-100 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  ) : null}

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
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">Vista previa del resultado</h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {activeTool ? TOOL_TITLES[activeTool].title : ""} · guárdalo o descárgalo aquí
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {toolExport ? (
                            <>
                              <button
                                type="button"
                                onClick={handleResultSave}
                                disabled={toolLoading || resultSaving}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {resultSaving ? <Spinner className="h-3.5 w-3.5" /> : null}
                                Guardar como archivo
                              </button>
                              <FormatPicker
                                label="Descargar"
                                downloading={resultDownloading}
                                disabled={toolLoading}
                                onDownload={handleResultDownload}
                              />
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={clearToolResult}
                            className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Volver a los datos
                          </button>
                        </div>
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
                            totalsRow={toolResult.totals ?? null}
                            totalOriginal={toolResult.total_original ?? null}
                            sort={resultSort}
                            onSort={toolSortable ? handleResultSort : undefined}
                            onPageChange={(offset) => toolFetcher && pageTool(toolFetcher, offset, resultSort)}
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
                          filtered={appliedFilter != null}
                          downloading={downloading}
                          onDownload={handleDownload}
                        />
                      </div>
                    </>
                  )}
                </Card>

                <Drawer
                  open={activeTool !== null}
                  title={activeTool ? TOOL_TITLES[activeTool].title : ""}
                  description={activeTool ? TOOL_TITLES[activeTool].description : undefined}
                  onClose={() => setActiveTool(null)}
                >
                  {/* Las herramientas quedan montadas (solo ocultas) para conservar su
                      configuración al cerrar/reabrir el panel; se reinician al cambiar de archivo u hoja. */}
                  <div hidden={activeTool !== "filter"} className="space-y-3">
                    <FilterBuilder
                      key={`filter-${detail.id}-${detail.active_sheet ?? ""}-${filterResetKey}`}
                      datasetId={detail.id}
                      columns={detail.columns}
                      applying={previewLoading}
                      onApply={handleApply}
                    />
                  </div>

                  <div hidden={activeTool !== "pivot"}>
                    <PivotView
                      key={`pivot-${detail.id}-${detail.active_sheet ?? ""}`}
                      dataset={detail}
                      filter={appliedFilter}
                      busy={toolLoading}
                      onPreview={runToolPreview}
                      onSaved={handleDerivedSaved}
                    />
                  </div>

                  <div hidden={activeTool !== "compute"}>
                    <ComputeView
                      key={`compute-${detail.id}-${detail.active_sheet ?? ""}`}
                      dataset={detail}
                      filter={appliedFilter}
                      busy={toolLoading}
                      onPreview={runToolPreview}
                      onSaved={handleDerivedSaved}
                    />
                  </div>

                  <div hidden={activeTool !== "replace"}>
                    <ReplaceView
                      key={`replace-${detail.id}-${detail.active_sheet ?? ""}`}
                      dataset={detail}
                      filter={appliedFilter}
                      busy={toolLoading}
                      onPreview={runToolPreview}
                      onSaved={handleDerivedSaved}
                    />
                  </div>

                  <div hidden={activeTool !== "dedupe"}>
                    <DedupeView
                      key={`dedupe-${detail.id}-${detail.active_sheet ?? ""}`}
                      dataset={detail}
                      filter={appliedFilter}
                      busy={toolLoading}
                      onPreview={runToolPreview}
                      onSaved={handleDerivedSaved}
                    />
                  </div>
                </Drawer>
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
