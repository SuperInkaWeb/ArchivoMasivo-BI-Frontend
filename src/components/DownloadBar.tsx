import { FormatPicker } from "@/components/FormatPicker";
import { formatNumber } from "@/lib/utils";
import type { DownloadOptions } from "@/lib/api";
import type { Delimiter, DownloadFormat } from "@/types";

interface DownloadBarProps {
  totalMatched: number | null;
  filtered: boolean; // si hay un filtro activo aplicado a la vista
  onDownload: (format: DownloadFormat, delimiter: Delimiter | undefined, options: DownloadOptions) => Promise<void>;
}

export function DownloadBar({ totalMatched, filtered, onDownload }: DownloadBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {totalMatched != null
          ? `Se descargarán ${formatNumber(totalMatched)} filas ${filtered ? "(filtradas)" : "(todo el archivo)"}.`
          : "Preparando la descarga…"}
      </p>
      <FormatPicker
        label={filtered ? "Descargar filtrado" : "Descargar"}
        disabled={totalMatched == null}
        onDownload={onDownload}
      />
    </div>
  );
}
