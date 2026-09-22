import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { pivotDataset, savePivot } from "@/services/datasets";
import { errorMessage, formatNumber } from "@/lib/utils";
import type { Aggregation, DatasetDetail, Measure, PivotResponse } from "@/types";

const PAGE_SIZE = 100;

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: "count", label: "Conteo" },
  { value: "count_distinct", label: "Conteo único" },
  { value: "sum", label: "Suma" },
  { value: "avg", label: "Promedio" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
];

interface PivotViewProps {
  dataset: DatasetDetail;
  onSaved: (name: string) => void;
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function PivotView({ dataset, onSaved }: PivotViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([{ aggregation: "count" }]);
  const [pivotColumn, setPivotColumn] = useState<string>("");

  const [result, setResult] = useState<PivotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableForGroup = columnNames.filter((name) => !groupBy.includes(name));
  const availableForPivot = columnNames.filter((name) => !groupBy.includes(name));

  function validate(): string | null {
    if (groupBy.length === 0) return "Elige al menos una columna para agrupar.";
    if (measures.length === 0) return "Añade al menos una métrica.";
    const incomplete = measures.find((m) => m.aggregation !== "count" && !m.column);
    if (incomplete) return "Cada métrica (excepto Conteo) necesita una columna.";
    return null;
  }

  function buildRequest(nextOffset: number) {
    return {
      filter: null,
      group_by: groupBy,
      measures,
      pivot_column: pivotColumn || null,
      limit: PAGE_SIZE,
      offset: nextOffset,
    };
  }

  async function run(nextOffset: number) {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await pivotDataset(dataset.id, buildRequest(nextOffset));
      setResult(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
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

  function updateMeasure(index: number, patch: Partial<Measure>) {
    setMeasures((current) => current.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Agrupar por */}
      <div className="space-y-2">
        <Label>Agrupar por (filas del reporte)</Label>
        <div className="flex flex-wrap items-center gap-2">
          {groupBy.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              {name}
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                onClick={() => setGroupBy((current) => current.filter((c) => c !== name))}
                aria-label={`Quitar ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          {availableForGroup.length > 0 ? (
            <Select
              className="h-8 w-48"
              value=""
              onChange={(event) => {
                if (event.target.value) setGroupBy((current) => [...current, event.target.value]);
              }}
            >
              <option value="">+ Añadir columna…</option>
              {availableForGroup.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      {/* Métricas */}
      <div className="space-y-2">
        <Label>Métricas (valores a calcular)</Label>
        <div className="space-y-2">
          {measures.map((measure, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                className="h-8 w-36"
                value={measure.aggregation}
                onChange={(event) =>
                  updateMeasure(index, { aggregation: event.target.value as Aggregation })
                }
              >
                {AGGREGATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                className="h-8 flex-1"
                value={measure.column ?? ""}
                onChange={(event) => updateMeasure(index, { column: event.target.value || null })}
              >
                <option value="">{measure.aggregation === "count" ? "— filas —" : "Elige columna…"}</option>
                {columnNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              {measures.length > 1 ? (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setMeasures((current) => current.filter((_, i) => i !== index))}
                  aria-label="Quitar métrica"
                >
                  Quitar
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMeasures((current) => [...current, { aggregation: "count" }])}
        >
          + Añadir métrica
        </Button>
      </div>

      {/* Cross-tab opcional */}
      <div className="space-y-2">
        <Label>Columnas (cross-tab, opcional)</Label>
        <Select
          className="h-8 w-full max-w-xs"
          value={pivotColumn}
          onChange={(event) => setPivotColumn(event.target.value)}
        >
          <option value="">— ninguna —</option>
          {availableForPivot.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-400">
          Sus valores distintos se convierten en columnas del reporte (máx. 50).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => run(0)} disabled={loading}>
          {loading ? <Spinner className="border-white/40 border-t-white" /> : null}
          Generar reporte
        </Button>
        {result ? (
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            Guardar como archivo
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {result ? <PivotResult result={result} loading={loading} onPageChange={(next) => run(next)} /> : null}
    </div>
  );
}

function PivotResult({
  result,
  loading,
  onPageChange,
}: {
  result: PivotResponse;
  loading: boolean;
  onPageChange: (offset: number) => void;
}) {
  const { columns, rows, total_matched, limit, offset } = result;
  const from = total_matched === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total_matched);
  const canPrev = offset > 0;
  const canNext = offset + limit < total_matched;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{formatNumber(total_matched)}</strong> filas en el reporte
        </span>
        <span>
          Mostrando {formatNumber(from)}–{formatNumber(to)}
        </span>
      </div>

      <div className="thin-scroll max-h-[48vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              {columns.map((column) => (
                <th
                  key={column}
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-600"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="odd:bg-white even:bg-slate-50/40">
                {columns.map((column) => (
                  <td key={column} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {renderCell(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canPrev || loading}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canNext || loading}
          onClick={() => onPageChange(offset + limit)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
