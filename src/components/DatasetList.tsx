import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner, Spinner } from "@/components/ui/feedback";
import { cn, formatBytes, formatNumber } from "@/lib/utils";
import type { DatasetSummary } from "@/types";

interface DatasetListProps {
  datasets: DatasetSummary[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (dataset: DatasetSummary) => void;
  onDelete: (dataset: DatasetSummary) => void;
}

export function DatasetList({
  datasets,
  selectedId,
  loading,
  error,
  onSelect,
  onDelete,
}: DatasetListProps) {
  if (loading && datasets.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
        <Spinner /> Cargando datasets…
      </div>
    );
  }
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>;
  if (datasets.length === 0) {
    return <EmptyState title="Aún no hay archivos" hint="Sube uno para empezar a filtrar." />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {datasets.map((dataset) => {
        const selectable = dataset.status === "ready";
        const isSelected = dataset.id === selectedId;
        return (
          <li
            key={dataset.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors",
              isSelected ? "bg-slate-50" : "hover:bg-slate-50/60",
              selectable ? "cursor-pointer" : "cursor-default",
            )}
            onClick={() => selectable && onSelect(dataset)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800" title={dataset.original_filename}>
                  {dataset.original_filename}
                </span>
                <StatusBadge status={dataset.status} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {dataset.row_count != null ? `${formatNumber(dataset.row_count)} filas · ` : ""}
                {formatBytes(dataset.size_bytes)}
              </p>
              {dataset.status === "failed" && dataset.error ? (
                <p className="mt-1 text-xs text-red-600">{dataset.error}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(dataset);
              }}
              aria-label={`Eliminar ${dataset.original_filename}`}
            >
              Eliminar
            </button>
          </li>
        );
      })}
    </ul>
  );
}
