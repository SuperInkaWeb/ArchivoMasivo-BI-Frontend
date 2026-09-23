import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormatPicker } from "@/components/FormatPicker";
import { PivotFieldConfig } from "@/components/PivotFieldConfig";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { downloadPivot, pivotDataset, savePivot } from "@/services/datasets";
import { errorMessage, saveBlob } from "@/lib/utils";
import type { DatasetDetail, Delimiter, DownloadFormat, Measure, PreviewResponse } from "@/types";

const PAGE_SIZE = 100;

interface PivotViewProps {
  dataset: DatasetDetail;
  busy: boolean;
  onPreview: (fetcher: (offset: number) => Promise<PreviewResponse>, countLabel?: string) => void;
  onSaved: (name: string) => void;
}

export function PivotView({ dataset, busy, onPreview, onSaved }: PivotViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([{ aggregation: "count" }]);
  const [pivotColumn, setPivotColumn] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function validate(): string | null {
    if (groupBy.length === 0) return "Elige al menos una columna para agrupar.";
    if (measures.length === 0) return "Añade al menos una métrica.";
    const incomplete = measures.find((m) => m.aggregation !== "count" && !m.column);
    if (incomplete) return "Cada métrica (excepto Conteo) necesita una columna.";
    return null;
  }

  function buildRequest(offset: number) {
    return {
      filter: null,
      group_by: groupBy,
      measures,
      pivot_column: pivotColumn || null,
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
    onPreview((offset) => pivotDataset(dataset.id, buildRequest(offset)), "filas en el reporte");
  }

  async function handleSave() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    const name = window.prompt("Nombre del reporte:", `${dataset.original_filename} — resumen`);
    if (!name || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await savePivot(dataset.id, { ...buildRequest(0), name: name.trim() });
      onSaved(name.trim());
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
        filter: null,
        group_by: groupBy,
        measures,
        pivot_column: pivotColumn || null,
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
      <PivotFieldConfig
        columns={columnNames}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        measures={measures}
        setMeasures={setMeasures}
        pivotColumn={pivotColumn}
        setPivotColumn={setPivotColumn}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
          Generar reporte
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner /> : null}
          Guardar como archivo
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Descarga el reporte completo en el formato que elijas.</p>
        <FormatPicker label="Descargar reporte" downloading={downloading} onDownload={handleDownload} />
      </div>

      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );
}
