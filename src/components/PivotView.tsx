import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { FormatPicker } from "@/components/FormatPicker";
import { PivotFieldConfig } from "@/components/PivotFieldConfig";
import { SaveAsDialog } from "@/components/SaveAsDialog";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { downloadPivot, pivotDataset, savePivot } from "@/services/datasets";
import { errorMessage, saveBlob } from "@/lib/utils";
import type {
  Aggregation,
  DatasetDetail,
  Delimiter,
  DownloadFormat,
  FilterGroup,
  Measure,
  PivotSort,
  PreviewResponse,
  ToolPreviewOptions,
} from "@/types";

const PAGE_SIZE = 100;

const AGG_LABELS: Record<Aggregation, string> = {
  count: "Conteo",
  count_distinct: "Conteo único",
  sum: "Suma",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
};

/** Etiqueta legible de una métrica para el selector de orden ("Suma de importe"). */
function measureLabel(measure: Measure): string {
  return measure.column ? `${AGG_LABELS[measure.aggregation]} de ${measure.column}` : "Conteo de filas";
}

interface PivotViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: el reporte se calcula solo sobre esas filas
  busy: boolean;
  onPreview: (fetcher: (offset: number) => Promise<PreviewResponse>, options: ToolPreviewOptions) => void;
  onSaved: (name: string) => void;
}

export function PivotView({ dataset, filter, busy, onPreview, onSaved }: PivotViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([{ aggregation: "count" }]);
  const [pivotColumn, setPivotColumn] = useState<string>("");
  // Orden del reporte. "" = por agrupación; "group:<col>" o "measure:<índice>".
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Mostrar valores como % del total (solo válido con métricas Suma/Conteo).
  const [percentOfTotal, setPercentOfTotal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // El "% del total" solo tiene sentido en métricas aditivas (Suma / Conteo).
  const percentAllowed =
    measures.length > 0 && measures.every((m) => m.aggregation === "sum" || m.aggregation === "count");
  const usePercent = percentOfTotal && percentAllowed;

  function validate(): string | null {
    if (groupBy.length === 0) return "Elige al menos una columna para agrupar.";
    if (measures.length === 0) return "Añade al menos una métrica.";
    const incomplete = measures.find((m) => m.aggregation !== "count" && !m.column);
    if (incomplete) return "Cada métrica (excepto Conteo) necesita una columna.";
    return null;
  }

  /** Traduce la selección de orden a la forma que espera el backend (o null = por defecto). */
  function buildSort(): PivotSort | null {
    if (sortBy.startsWith("group:")) {
      const column = sortBy.slice(6);
      return groupBy.includes(column) ? { column, direction: sortDir } : null;
    }
    if (sortBy.startsWith("measure:")) {
      const index = Number(sortBy.slice(8));
      return index < measures.length ? { measure_index: index, direction: sortDir } : null;
    }
    return null;
  }

  function buildRequest(offset: number) {
    return {
      filter,
      group_by: groupBy,
      measures,
      pivot_column: pivotColumn || null,
      sort: buildSort(),
      percent_of_total: usePercent,
      limit: PAGE_SIZE,
      offset,
    };
  }

  function generate() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    onPreview((offset) => pivotDataset(dataset.id, buildRequest(offset)), {
      countLabel: "filas en el reporte",
      download: handleDownload,
      save: openSave,
    });
  }

  function openSave() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaveOpen(true);
  }

  async function doSave(name: string) {
    setSaving(true);
    setError(null);
    try {
      await savePivot(dataset.id, { ...buildRequest(0), name });
      onSaved(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: DownloadFormat, delimiter?: Delimiter) {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const file = await downloadPivot(dataset.id, {
        filter,
        group_by: groupBy,
        measures,
        pivot_column: pivotColumn || null,
        sort: buildSort(),
        percent_of_total: usePercent,
        format,
        ...(format === "txt" && delimiter ? { delimiter } : {}),
      });
      saveBlob(file.blob, file.filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {filter ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          El reporte se calculará solo sobre las filas del filtro activo.
        </p>
      ) : null}
      <PivotFieldConfig
        columns={columnNames}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        measures={measures}
        setMeasures={setMeasures}
        pivotColumn={pivotColumn}
        setPivotColumn={setPivotColumn}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Label htmlFor="pivot-sort" className="shrink-0">
          Ordenar por
        </Label>
        <Select
          id="pivot-sort"
          className="h-8 w-48"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="">Agrupación (por defecto)</option>
          {groupBy.map((column) => (
            <option key={`group:${column}`} value={`group:${column}`}>
              Fila: {column}
            </option>
          ))}
          {measures.map((measure, index) => (
            <option key={`measure:${index}`} value={`measure:${index}`}>
              {measureLabel(measure)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Dirección del orden"
          className="h-8 w-36"
          value={sortDir}
          disabled={!sortBy}
          onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
        >
          <option value="desc">Mayor a menor</option>
          <option value="asc">Menor a mayor</option>
        </Select>

        <label
          className={
            "ml-auto flex items-center gap-1.5 text-xs " +
            (percentAllowed ? "text-slate-600" : "text-slate-300")
          }
          title={
            percentAllowed
              ? "Muestra cada valor como % del total"
              : "Solo disponible con métricas de Suma o Conteo"
          }
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-emerald-600"
            checked={usePercent}
            disabled={!percentAllowed}
            onChange={(event) => setPercentOfTotal(event.target.checked)}
          />
          Mostrar como % del total
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
          Generar reporte
        </Button>
        <Button variant="secondary" onClick={openSave} disabled={saving}>
          {saving ? <Spinner /> : null}
          Guardar como archivo
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Descarga el reporte completo en el formato que elijas.</p>
        <FormatPicker label="Descargar reporte" downloading={downloading} onDownload={handleDownload} />
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <SaveAsDialog
        open={saveOpen}
        title="Guardar reporte"
        label="Nombre del reporte"
        defaultName={`${dataset.original_filename} — resumen`}
        onCancel={() => setSaveOpen(false)}
        onConfirm={(name) => {
          setSaveOpen(false);
          doSave(name);
        }}
      />
    </div>
  );
}
