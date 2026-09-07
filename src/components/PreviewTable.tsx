import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import type { PreviewResponse } from "@/types";

interface PreviewTableProps {
  preview: PreviewResponse | null;
  loading: boolean;
  error: string | null;
  onPageChange: (offset: number) => void;
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "verdadero" : "falso";
  return String(value);
}

export function PreviewTable({ preview, loading, error, onPageChange }: PreviewTableProps) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{formatNumber(total_matched)}</strong> filas coinciden
          {loading ? <Spinner className="ml-2 inline-block h-3 w-3 align-middle" /> : null}
        </span>
        <span>
          Mostrando {formatNumber(from)}–{formatNumber(to)}
        </span>
      </div>

      <div className="thin-scroll overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium text-slate-600"
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
