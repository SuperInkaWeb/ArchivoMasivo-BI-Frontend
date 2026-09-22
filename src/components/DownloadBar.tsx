import { FormatPicker } from "@/components/FormatPicker";
import { formatNumber } from "@/lib/utils";
import type { Delimiter, DownloadFormat } from "@/types";

interface DownloadBarProps {
  totalMatched: number | null;
  downloading: boolean;
  onDownload: (format: DownloadFormat, delimiter?: Delimiter) => void;
}

export function DownloadBar({ totalMatched, downloading, onDownload }: DownloadBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {totalMatched != null
          ? `Se descargarán ${formatNumber(totalMatched)} filas (solo el resultado filtrado).`
          : "Aplica un filtro para habilitar la descarga."}
      </p>
      <FormatPicker
        label="Descargar filtrado"
        downloading={downloading}
        disabled={totalMatched == null}
        onDownload={onDownload}
      />
    </div>
  );
}
