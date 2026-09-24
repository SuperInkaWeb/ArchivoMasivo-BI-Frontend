import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { columnStats } from "@/services/datasets";
import { cleanNumber, errorMessage, formatNumber } from "@/lib/utils";
import type { ColumnStats, DatasetDetail, FilterGroup } from "@/types";

interface StatsViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: las estadísticas se calculan sobre esas filas
}

/** Muestra un valor (número limpio o texto) o un guion si es nulo. */
function showValue(value: string | number | null): string {
  if (value === null) return "—";
  return typeof value === "number" ? cleanNumber(value) : value;
}

/** Estadísticas descriptivas de una columna: conteos, mín/máx, suma/promedio y top valores. */
export function StatsView({ dataset, filter }: StatsViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [column, setColumn] = useState(columnNames[0] ?? "");
  const [stats, setStats] = useState<ColumnStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    if (!column) return;
    setLoading(true);
    setError(null);
    try {
      setStats(await columnStats(dataset.id, { filter, column }));
    } catch (err) {
      setError(errorMessage(err));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  const maxTop = stats && stats.top_values.length > 0 ? stats.top_values[0].count : 0;

  return (
    <div className="flex flex-col gap-4">
      {filter ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          Las estadísticas se calculan solo sobre las filas del filtro activo.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="stats-column">Columna</Label>
          <Select
            id="stats-column"
            className="mt-1 h-9 w-56"
            value={column}
            onChange={(event) => setColumn(event.target.value)}
          >
            {columnNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={calculate} disabled={loading || !column}>
          {loading ? <Spinner className="border-white/40 border-t-white" /> : null}
          Calcular
        </Button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {stats ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Filas" value={formatNumber(stats.total)} />
            <StatCard label="Distintos" value={formatNumber(stats.distinct)} />
            <StatCard label="Con dato" value={formatNumber(stats.non_null)} />
            <StatCard label="Vacíos (nulos)" value={formatNumber(stats.nulls)} />
            <StatCard label="Mínimo" value={showValue(stats.minimum)} />
            <StatCard label="Máximo" value={showValue(stats.maximum)} />
            {stats.is_numeric ? (
              <>
                <StatCard label="Suma" value={showValue(stats.total_sum)} />
                <StatCard label="Promedio" value={showValue(stats.average)} />
              </>
            ) : null}
          </div>

          {stats.top_values.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Valores más frecuentes</p>
              <ul className="space-y-1.5">
                {stats.top_values.map((item) => (
                  <li key={item.value} className="flex items-center gap-2">
                    <span className="w-40 truncate text-xs text-slate-700" title={item.value}>
                      {item.value === "" ? "(vacío)" : item.value}
                    </span>
                    <span className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
                      <span
                        className="absolute inset-y-0 left-0 rounded bg-emerald-400/70"
                        style={{ width: `${maxTop > 0 ? (item.count / maxTop) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-slate-500">
                      {formatNumber(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-800" title={value}>
        {value}
      </p>
    </div>
  );
}
