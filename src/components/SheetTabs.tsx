import { useRef } from "react";
import type { DatasetSummary } from "@/types";

interface SheetTabsProps {
  datasets: DatasetSummary[];
  selectedId: string | null;
  uploading: boolean;
  onSelect: (dataset: DatasetSummary) => void;
  onUpload: (files: File[]) => void;
}

/** Punto de color según el estado de ingesta (o null si está listo). */
function statusDot(status: DatasetSummary["status"]): string | null {
  if (status === "failed") return "bg-red-500";
  if (status === "ready") return null;
  return "bg-amber-400 animate-pulse"; // pending / processing
}

/** Barra inferior de pestañas estilo Excel: una por archivo/reporte. */
export function SheetTabs({ datasets, selectedId, uploading, onSelect, onUpload }: SheetTabsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onUpload(files);
    event.target.value = ""; // permite volver a elegir el mismo archivo
  }

  return (
    <div className="flex shrink-0 items-stretch gap-1 overflow-x-auto border-t border-slate-200 bg-slate-100 px-2 py-1">
      {datasets.map((dataset) => {
        const active = dataset.id === selectedId;
        const derived = dataset.origin !== "uploaded";
        const dot = statusDot(dataset.status);
        return (
          <button
            key={dataset.id}
            type="button"
            onClick={() => onSelect(dataset)}
            title={dataset.original_filename}
            className={
              "-mb-px flex max-w-[200px] items-center gap-1.5 whitespace-nowrap rounded-t-md border px-3 py-1.5 text-xs transition-colors " +
              (active
                ? "border-slate-300 border-b-white bg-white font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:bg-slate-50")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 shrink-0 rounded-full " + (dot ?? (derived ? "bg-emerald-500" : "bg-slate-300"))
              }
            />
            <span className="truncate">{dataset.original_filename}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Añadir un archivo"
        aria-label="Añadir un archivo"
        className="flex items-center rounded-t-md px-2.5 py-1.5 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
      >
        +
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}
