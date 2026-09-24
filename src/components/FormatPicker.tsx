import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import type { DownloadOptions } from "@/lib/api";
import type { Delimiter, DownloadFormat } from "@/types";

interface FormatPickerProps {
  /** Texto del botón (p. ej. "Descargar filtrado", "Descargar reporte"). */
  label: string;
  disabled?: boolean;
  /** Ejecuta la descarga; recibe opciones de cancelación y progreso. */
  onDownload: (format: DownloadFormat, delimiter: Delimiter | undefined, options: DownloadOptions) => Promise<void>;
}

/**
 * Selector de formato (CSV / Excel / TXT) que además gestiona el ciclo de la descarga:
 * muestra el progreso por bytes y permite cancelar. Reutilizado por todas las descargas.
 */
export function FormatPicker({ label, disabled = false, onDownload }: FormatPickerProps) {
  const [format, setFormat] = useState<DownloadFormat>("csv");
  const [delimiter, setDelimiter] = useState<Delimiter>("tab");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function start() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setDownloading(true);
    setProgress(null);
    try {
      await onDownload(format, format === "txt" ? delimiter : undefined, {
        signal: controller.signal,
        onProgress: setProgress,
      });
    } catch {
      // El llamador ya muestra los errores; aquí solo se cierra el estado de descarga.
    } finally {
      setDownloading(false);
      setProgress(null);
      controllerRef.current = null;
    }
  }

  if (downloading) {
    return (
      <div className="flex items-center gap-2">
        {progress != null ? (
          <div className="h-2 w-28 overflow-hidden rounded bg-slate-200">
            <div
              className="h-full rounded bg-emerald-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : (
          <Spinner />
        )}
        <span className="w-9 text-xs tabular-nums text-slate-500">
          {progress != null ? `${Math.round(progress * 100)}%` : "…"}
        </span>
        <button
          type="button"
          onClick={() => controllerRef.current?.abort()}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        className="h-9 w-28"
        value={format}
        onChange={(event) => setFormat(event.target.value as DownloadFormat)}
      >
        <option value="csv">CSV</option>
        <option value="xlsx">Excel</option>
        <option value="txt">TXT</option>
      </Select>
      {format === "txt" ? (
        <Select
          className="h-9 w-40"
          value={delimiter}
          onChange={(event) => setDelimiter(event.target.value as Delimiter)}
          aria-label="Separador del TXT"
        >
          <option value="tab">Tabulación</option>
          <option value="pipe">Pipe (|)</option>
          <option value="semicolon">Punto y coma (;)</option>
          <option value="comma">Coma (,)</option>
        </Select>
      ) : null}
      <Button disabled={disabled} onClick={start}>
        {label}
      </Button>
    </div>
  );
}
