import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import type { PreviewResponse, SortSpec } from "@/types";

interface PreviewTableProps {
  preview: PreviewResponse | null;
  loading: boolean;
  error: string | null;
  sort: SortSpec | null;
  onSort: (column: string) => void;
  onPageChange: (offset: number) => void;
}

function sortIndicator(column: string, sort: SortSpec | null): string {
  if (!sort || sort.column !== column) return "↕";
  return sort.direction === "asc" ? "▲" : "▼";
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "verdadero" : "falso";
  return String(value);
}

export function PreviewTable({ preview, loading, error, sort, onSort, onPageChange }: PreviewTableProps) {
  if (error) return <ErrorBanner message={error} />;
  if (!preview && loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Spinner /> Aplicando filtros…
      </div>
    );
  }
  if (!preview) {
    return <EmptyState title="Sin resultados aún" hint="Aplica un filtro para ver la vista previa." />;
  }

  const { columns, rows, total_matched, limit, offset } = preview;
  const from = total_matched === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total_matched);
  const canPrev = offset > 0;
  const canNext = offset + limit < total_matched;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{formatNumber(total_matched)}</strong> filas coinciden
          {loading ? <Spinner className="ml-2 inline-block h-3 w-3 align-middle" /> : null}
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
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 p-0 font-medium text-slate-600"
                >
                  <button
                    type="button"
                    onClick={() => onSort(column)}
                    className="flex w-full items-center gap-1 px-3 py-2 text-left hover:bg-slate-100"
                    title="Ordenar por esta columna"
                  >
                    <span>{column}</span>
                    <span className="text-[10px] text-slate-400">{sortIndicator(column, sort)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                  Ninguna fila coincide con el filtro.
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
