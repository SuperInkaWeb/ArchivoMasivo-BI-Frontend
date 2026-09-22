import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import type { Delimiter, DownloadFormat } from "@/types";

interface DownloadBarProps {
  totalMatched: number | null;
  downloading: boolean;
  onDownload: (format: DownloadFormat, delimiter?: Delimiter) => void;
}

export function DownloadBar({ totalMatched, downloading, onDownload }: DownloadBarProps) {
  const [format, setFormat] = useState<DownloadFormat>("csv");
  const [delimiter, setDelimiter] = useState<Delimiter>("tab");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {totalMatched != null
          ? `Se descargarán ${formatNumber(totalMatched)} filas (solo el resultado filtrado).`
          : "Aplica un filtro para habilitar la descarga."}
      </p>
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
          disabled={totalMatched == null || downloading}
          onClick={() => onDownload(format, format === "txt" ? delimiter : undefined)}
        >
          {downloading ? <Spinner className="border-white/40 border-t-white" /> : null}
          Descargar filtrado
        </Button>
      </div>
    </div>
  );
}
