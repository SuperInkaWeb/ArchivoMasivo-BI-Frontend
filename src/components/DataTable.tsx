import { Button } from "@/components/ui/button";
import { cleanNumber, formatNumber } from "@/lib/utils";
import type { ResultSort } from "@/types";

interface DataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  onPageChange: (offset: number) => void;
  countLabel?: string;
  // Fila de totales fijada al pie (p. ej. Total general del pivote). Sus claves son
  // nombres de columna; las columnas sin clave quedan en blanco.
  totalsRow?: Record<string, unknown> | null;
  totalsLabel?: string;
  // Filas antes de un proceso (p. ej. eliminar duplicados): muestra cuántas se quitaron.
  totalOriginal?: number | null;
  // Orden actual y callback para ordenar por encabezado (solo si la herramienta lo admite).
  sort?: ResultSort | null;
  onSort?: (column: string) => void;
}

function sortIndicator(column: string, sort: ResultSort | null | undefined): string {
  if (!sort || sort.column !== column) return "↕";
  return sort.direction === "asc" ? "▲" : "▼";
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return cleanNumber(value);
  return String(value);
}

/** Celda de la fila de totales: en blanco si la columna no tiene total (p. ej. dimensiones). */
function renderTotal(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return cleanNumber(value);
  return String(value);
}

/** Tabla paginada de solo lectura para resultados de análisis (pivote / columnas calculadas). */
export function DataTable({
  columns,
  rows,
  total,
  limit,
  offset,
  loading,
  onPageChange,
  countLabel = "filas",
  totalsRow,
  totalsLabel = "Total general",
  totalOriginal,
  sort,
  onSort,
}: DataTableProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;
  const removed = totalOriginal != null ? totalOriginal - total : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{formatNumber(total)}</strong> {countLabel}
          {totalOriginal != null ? (
            <span className="text-slate-400">
              {" "}
              · quitó {formatNumber(removed)} de {formatNumber(totalOriginal)}
            </span>
          ) : null}
        </span>
        <span>
          Mostrando {formatNumber(from)}–{formatNumber(to)}
        </span>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              {columns.map((column) => (
                <th
                  key={column}
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-600"
                >
                  {onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column)}
                      title="Ordenar por esta columna"
                      className="flex w-full items-center justify-between gap-1.5 hover:text-slate-900"
                    >
                      <span className="truncate">{column}</span>
                      <span className="text-[10px] text-slate-400">{sortIndicator(column, sort)}</span>
                    </button>
                  ) : (
                    column
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="odd:bg-white even:bg-slate-50/40">
                  {columns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {renderCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totalsRow && rows.length > 0 ? (
            <tfoot>
              <tr className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-800">
                {columns.map((column, index) => (
                  <td key={column} className="whitespace-nowrap px-3 py-2">
                    {index === 0 ? totalsLabel : renderTotal(totalsRow[column])}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
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
