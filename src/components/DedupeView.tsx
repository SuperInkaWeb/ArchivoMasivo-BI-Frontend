import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormatPicker } from "@/components/FormatPicker";
import { SaveAsDialog } from "@/components/SaveAsDialog";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { dedupeDataset, downloadDedupe, saveDedupe } from "@/services/datasets";
import { errorMessage, isAbortError, saveBlob } from "@/lib/utils";
import type { DownloadOptions } from "@/lib/api";
import type {
  DatasetDetail,
  Delimiter,
  DownloadFormat,
  FilterGroup,
  ResultFetcher,
  ToolPreviewOptions,
} from "@/types";

const PAGE_SIZE = 100;

interface DedupeViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: se quitan duplicados solo entre esas filas
  busy: boolean;
  onPreview: (fetcher: ResultFetcher, options: ToolPreviewOptions) => void;
  onSaved: (name: string) => void;
}

/** Quitar duplicados: por fila completa (sin claves) o por columnas clave elegidas. */
export function DedupeView({ dataset, filter, busy, onPreview, onSaved }: DedupeViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wholeRow = keyColumns.length === 0;

  function toggleColumn(name: string) {
    setKeyColumns((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function generate() {
    setError(null);
    onPreview(
      (offset, sort) =>
        dedupeDataset(dataset.id, {
          filter,
          key_columns: keyColumns,
          ...(sort ? { order_column: sort.column, order_direction: sort.direction } : {}),
          limit: PAGE_SIZE,
          offset,
        }),
      { countLabel: "filas únicas", sortable: true, download: handleDownload, save: () => setSaveOpen(true) },
    );
  }

  async function doSave(name: string) {
    setSaving(true);
    setError(null);
    try {
      await saveDedupe(dataset.id, { filter, key_columns: keyColumns, name });
      onSaved(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: DownloadFormat, delimiter: Delimiter | undefined, options: DownloadOptions) {
    setError(null);
    try {
      const file = await downloadDedupe(
        dataset.id,
        { filter, key_columns: keyColumns, format, ...(format === "txt" && delimiter ? { delimiter } : {}) },
        options,
      );
      saveBlob(file.blob, file.filename);
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {filter ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          Los duplicados se buscarán solo entre las filas del filtro activo.
        </p>
      ) : null}

      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-700">¿Qué hace duplicada a una fila?</p>
        <p className="mt-1 text-xs text-slate-500">
          {wholeRow
            ? "Sin columnas elegidas: se quitan las filas idénticas en todas las columnas."
            : "Se conserva la primera fila de cada combinación de las columnas elegidas."}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {columnNames.map((name) => {
            const active = keyColumns.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleColumn(name)}
                className={
                  "rounded-md border px-2 py-1 text-xs transition-colors " +
                  (active
                    ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                    : "border-slate-400 bg-white text-slate-600 hover:border-emerald-400")
                }
              >
                {name}
              </button>
            );
          })}
        </div>

        {!wholeRow ? (
          <button
            type="button"
            onClick={() => setKeyColumns([])}
            className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-emerald-700 hover:underline"
          >
            Usar la fila completa (quitar selección)
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
          Ver resultado
        </Button>
        <Button variant="secondary" onClick={() => setSaveOpen(true)} disabled={saving}>
          {saving ? <Spinner /> : null}
          Guardar como archivo
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Descarga todas las filas sin duplicados en tu formato.</p>
        <FormatPicker label="Descargar sin duplicados" onDownload={handleDownload} />
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <SaveAsDialog
        open={saveOpen}
        title="Guardar archivo sin duplicados"
        defaultName={`${dataset.original_filename} — sin duplicados`}
        onCancel={() => setSaveOpen(false)}
        onConfirm={(name) => {
          setSaveOpen(false);
          doSave(name);
        }}
      />
    </div>
  );
}
