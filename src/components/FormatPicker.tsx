import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import type { Delimiter, DownloadFormat } from "@/types";

interface FormatPickerProps {
  /** Texto del botón (p. ej. "Descargar filtrado", "Descargar reporte"). */
  label: string;
  downloading: boolean;
  disabled?: boolean;
  onDownload: (format: DownloadFormat, delimiter?: Delimiter) => void;
}

/**
 * Selector de formato de descarga (CSV / Excel / TXT) con separador para TXT.
 * Reutilizado por la descarga filtrada, el pivote y las columnas calculadas.
 */
export function FormatPicker({ label, downloading, disabled = false, onDownload }: FormatPickerProps) {
  const [format, setFormat] = useState<DownloadFormat>("csv");
  const [delimiter, setDelimiter] = useState<Delimiter>("tab");

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
      <Button
        disabled={disabled || downloading}
        onClick={() => onDownload(format, format === "txt" ? delimiter : undefined)}
      >
        {downloading ? <Spinner className="border-white/40 border-t-white" /> : null}
        {label}
      </Button>
    </div>
  );
}
