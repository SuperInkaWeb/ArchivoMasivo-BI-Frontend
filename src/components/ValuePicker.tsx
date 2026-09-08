import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import { columnValues } from "@/services/datasets";
import { cn, errorMessage } from "@/lib/utils";

interface ValuePickerProps {
  datasetId: string;
  column: string;
  selected: string[];
  onChange: (values: string[]) => void;
}

/** Desplegable de valores únicos con casillas (estilo Excel), con búsqueda. */
export function ValuePicker({ datasetId, column, selected, onChange }: ValuePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce del texto de búsqueda para no golpear el backend en cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Carga los valores distintos cuando el desplegable está abierto.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    columnValues(datasetId, column, debounced || undefined)
      .then((result) => {
        if (!active) return;
        setValues(result.values);
        setTruncated(result.truncated);
        setError(null);
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, datasetId, column, debounced]);

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  const label = selected.length > 0 ? `${selected.length} seleccionado(s)` : "Elegir valores…";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        <span className={cn("truncate", selected.length === 0 && "text-slate-400")}>{label}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <Input
            autoFocus
            value={search}
            placeholder="Buscar valor…"
            onChange={(event) => setSearch(event.target.value)}
            className="mb-2 h-8"
          />
          {selected.length > 0 ? (
            <button
              type="button"
              className="mb-1 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => onChange([])}
            >
              Limpiar selección ({selected.length})
            </button>
          ) : null}

          <div className="thin-scroll max-h-56 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-1 py-3 text-xs text-slate-500">
                <Spinner className="h-3 w-3" /> Cargando…
              </div>
            ) : error ? (
              <p className="px-1 py-2 text-xs text-red-600">{error}</p>
            ) : values.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-400">Sin valores.</p>
            ) : (
              values.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => toggleValue(value)}
                  />
                  <span className="truncate" title={value}>
                    {value}
                  </span>
                </label>
              ))
            )}
          </div>

          {truncated ? (
            <p className="mt-1 border-t border-slate-100 pt-1 text-[11px] text-slate-400">
              Se muestran los primeros resultados. Refina la búsqueda para ver más.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
