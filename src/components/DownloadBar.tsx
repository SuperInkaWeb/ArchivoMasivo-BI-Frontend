import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import type { DownloadFormat } from "@/types";

interface DownloadBarProps {
  totalMatched: number | null;
  downloading: boolean;
  onDownload: (format: DownloadFormat) => void;
}

export function DownloadBar({ totalMatched, downloading, onDownload }: DownloadBarProps) {
  const [format, setFormat] = useState<DownloadFormat>("csv");

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
        </Select>
        <Button disabled={totalMatched == null || downloading} onClick={() => onDownload(format)}>
          {downloading ? <Spinner className="border-white/40 border-t-white" /> : null}
          Descargar filtrado
        </Button>
      </div>
    </div>
  );
}
