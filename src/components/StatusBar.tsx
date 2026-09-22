import { Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import { MAX_SHEET_ROWS } from "@/hooks/useSheetData";

export interface SelectionStats {
  count: number; // celdas no vacías seleccionadas
  sum: number | null; // suma de las numéricas (null si no hay)
  average: number | null;
}

interface StatusBarProps {
  total: number | null;
  capped: boolean;
  loading: boolean;
  selection: SelectionStats | null;
}

/** Redondea a 2 decimales evitando artefactos de coma flotante. */
function formatDecimal(value: number): string {
  return value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
}

/** Pie de la hoja: total de filas + agregados de la selección (estilo Excel). */
export function StatusBar({ total, capped, loading, selection }: StatusBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
      <span>
        <strong className="text-slate-700">{total != null ? formatNumber(total) : "…"}</strong> filas
        {loading ? <Spinner className="ml-2 inline-block h-3 w-3 align-middle" /> : null}
        {capped ? (
          <span className="ml-2 text-amber-600">· en pantalla: primeras {formatNumber(MAX_SHEET_ROWS)}</span>
        ) : null}
      </span>
      {selection ? (
        <span className="flex flex-wrap items-center gap-3">
          <span>
            Recuento: <strong className="text-slate-700">{formatNumber(selection.count)}</strong>
          </span>
          {selection.sum != null ? (
            <span>
              Suma: <strong className="text-slate-700">{formatDecimal(selection.sum)}</strong>
            </span>
          ) : null}
          {selection.average != null ? (
            <span>
              Promedio: <strong className="text-slate-700">{formatDecimal(selection.average)}</strong>
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
