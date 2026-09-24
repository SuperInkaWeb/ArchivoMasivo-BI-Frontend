import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { pivotDataset } from "@/services/datasets";
import { cleanNumber, errorMessage, formatNumber } from "@/lib/utils";
import type { Aggregation, DatasetDetail, FilterGroup } from "@/types";

// Un gráfico es una tabla dinámica de 1 categoría + 1 métrica: se reutiliza ese endpoint.
const TOP_OPTIONS = [10, 20, 30, 50];

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: "count", label: "Conteo de filas" },
  { value: "sum", label: "Suma" },
  { value: "avg", label: "Promedio" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
  { value: "count_distinct", label: "Conteo único" },
];

interface ChartBar {
  label: string;
  value: number;
}

interface ChartData {
  title: string;
  measureLabel: string;
  bars: ChartBar[];
}

interface ChartViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: el gráfico se calcula solo sobre esas filas
}

/** Gráfico de barras horizontales del top-N de una categoría por una métrica (reutiliza el pivote). */
export function ChartView({ dataset, filter }: ChartViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [category, setCategory] = useState(columnNames[0] ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("count");
  const [measureColumn, setMeasureColumn] = useState<string>("");
  const [topN, setTopN] = useState(20);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsColumn = aggregation !== "count";

  async function generate() {
    if (!category) return setError("Elige una categoría.");
    if (needsColumn && !measureColumn) return setError("Elige la columna de la métrica.");
    setLoading(true);
    setError(null);
    try {
      const response = await pivotDataset(dataset.id, {
        filter,
        group_by: [category],
        measures: [{ aggregation, ...(needsColumn ? { column: measureColumn } : {}) }],
        pivot_column: null,
        sort: { measure_index: 0, direction: "desc" },
        limit: topN,
        offset: 0,
      });
      const [labelKey, valueKey] = response.columns;
      const bars = response.rows.map((row) => ({
        label: row[labelKey] == null ? "(vacío)" : String(row[labelKey]),
        value: Number(row[valueKey]) || 0,
      }));
      const measureLabel = needsColumn
        ? `${AGGREGATIONS.find((a) => a.value === aggregation)?.label} de ${measureColumn}`
        : "Conteo de filas";
      setChart({ title: `${measureLabel} por ${category}`, measureLabel, bars });
    } catch (err) {
      setError(errorMessage(err));
      setChart(null);
    } finally {
      setLoading(false);
    }
  }

  const maxValue = chart && chart.bars.length > 0 ? Math.max(...chart.bars.map((bar) => bar.value)) : 0;

  return (
    <div className="flex flex-col gap-4">
      {filter ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          El gráfico se calcula solo sobre las filas del filtro activo.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label htmlFor="chart-category">Categoría (eje)</Label>
          <Select
            id="chart-category"
            className="mt-1 h-9 w-full"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {columnNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="chart-agg">Métrica</Label>
          <Select
            id="chart-agg"
            className="mt-1 h-9 w-full"
            value={aggregation}
            onChange={(event) => setAggregation(event.target.value as Aggregation)}
          >
            {AGGREGATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="chart-measure">Columna</Label>
          <Select
            id="chart-measure"
            className="mt-1 h-9 w-full"
            value={measureColumn}
            disabled={!needsColumn}
            onChange={(event) => setMeasureColumn(event.target.value)}
          >
            <option value="">{needsColumn ? "Elige columna…" : "(no aplica)"}</option>
            {columnNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="chart-top">Mostrar</Label>
          <Select
            id="chart-top"
            className="mt-1 h-9 w-full"
            value={topN}
            onChange={(event) => setTopN(Number(event.target.value))}
          >
            {TOP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Top {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button onClick={generate} disabled={loading}>
        {loading ? <Spinner className="border-white/40 border-t-white" /> : null}
        Generar gráfico
      </Button>

      {error ? <ErrorBanner message={error} /> : null}

      {chart ? (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">{chart.title}</p>
          {chart.bars.length === 0 ? (
            <p className="text-xs text-slate-400">Sin datos para graficar.</p>
          ) : (
            <ul className="space-y-2">
              {chart.bars.map((bar, index) => (
                <li key={`${bar.label}-${index}`} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-xs text-slate-700" title={bar.label}>
                    {bar.label}
                  </span>
                  <span className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-emerald-500/80"
                      style={{ width: `${maxValue > 0 ? Math.max(bar.value, 0) / maxValue * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-600">
                    {cleanNumber(bar.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            {formatNumber(chart.bars.length)} categorías · {chart.measureLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}
