import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

interface PopupPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const POPUP_WIDTH = 288;

/** Desplegable de valores únicos con casillas (estilo Excel), con búsqueda. */
export function ValuePicker({ datasetId, column, selected, onChange }: ValuePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition | null>(null);
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

  // Coloca el popup con posición fija respecto al botón (se abre hacia arriba si no cabe).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, POPUP_WIDTH);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      setPosition({
        left,
        width,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: (openUp ? spaceAbove : spaceBelow) - 16,
      });
    }
    place();
    window.addEventListener("scroll", place, true); // captura el scroll de contenedores internos
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Cierra al hacer clic fuera (contando el popup, que vive en un portal).
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  const label = selected.length > 0 ? `${selected.length} seleccionado(s)` : "Elegir valores…";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-400 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        <span className={cn("truncate", selected.length === 0 && "text-slate-400")}>{label}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
              }}
              className="z-50 flex flex-col rounded-lg border border-slate-300 bg-white p-2 shadow-xl"
            >
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
                  className="mb-1 shrink-0 text-left text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => onChange([])}
                >
                  Limpiar selección ({selected.length})
                </button>
              ) : null}

              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
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
                <p className="mt-1 shrink-0 border-t border-slate-100 pt-1 text-[11px] text-slate-400">
                  Se muestran los primeros resultados. Refina la búsqueda para ver más.
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
