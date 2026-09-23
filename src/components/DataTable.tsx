import { Button } from "@/components/ui/button";
import { cleanNumber, formatNumber } from "@/lib/utils";

interface DataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  onPageChange: (offset: number) => void;
  countLabel?: string;
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
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
}: DataTableProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{formatNumber(total)}</strong> {countLabel}
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
                  {column}
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
