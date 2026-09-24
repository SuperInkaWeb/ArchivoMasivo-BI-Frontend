import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormatPicker } from "@/components/FormatPicker";
import { Input, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { downloadReplace, replaceDataset, saveReplace } from "@/services/datasets";
import { errorMessage, saveBlob } from "@/lib/utils";
import type {
  DatasetDetail,
  Delimiter,
  DownloadFormat,
  FilterGroup,
  MatchMode,
  PreviewResponse,
  ReplacementRule,
  ToolPreviewOptions,
} from "@/types";

const PAGE_SIZE = 100;

const MODES: Array<{ value: MatchMode; label: string; hint: string }> = [
  { value: "exact", label: "Valor exacto", hint: "Reemplaza solo cuando la celda es idéntica al texto buscado." },
  { value: "contains", label: "Contiene", hint: "Reemplaza cada aparición del texto dentro de la celda (distingue mayúsculas)." },
];

interface RuleDraft {
  column: string;
  mode: MatchMode;
  search: string;
  replace: string;
  caseSensitive: boolean;
}

interface ReplaceViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: la corrección se aplica solo sobre esas filas
  busy: boolean;
  onPreview: (fetcher: (offset: number) => Promise<PreviewResponse>, options: ToolPreviewOptions) => void;
  onSaved: (name: string) => void;
}

function newRule(firstColumn: string): RuleDraft {
  return { column: firstColumn, mode: "exact", search: "", replace: "", caseSensitive: true };
}

export function ReplaceView({ dataset, filter, busy, onPreview, onSaved }: ReplaceViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [drafts, setDrafts] = useState<RuleDraft[]>([newRule(columnNames[0] ?? "")]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRule(index: number, patch: Partial<RuleDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function buildRules(): ReplacementRule[] | null {
    const rules: ReplacementRule[] = [];
    for (const draft of drafts) {
      if (!draft.column) return fail("Elige la columna a corregir.");
      if (draft.search.trim() === "") return fail("Escribe el texto a buscar.");
      rules.push({
        column: draft.column,
        mode: draft.mode,
        search: draft.search,
        replace: draft.replace,
        ...(draft.mode === "exact" ? { case_sensitive: draft.caseSensitive } : {}),
      });
    }
    return rules;
  }

  function fail(message: string): null {
    setError(message);
    return null;
  }

  function generate() {
    const replacements = buildRules();
    if (!replacements) return;
    setError(null);
    onPreview((offset) => replaceDataset(dataset.id, { filter, replacements, limit: PAGE_SIZE, offset }), {
      download: handleDownload,
      save: handleSave,
    });
  }

  async function handleSave() {
    const replacements = buildRules();
    if (!replacements) return;
    const name = window.prompt("Nombre del archivo corregido:", `${dataset.original_filename} — corregido`);
    if (!name || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveReplace(dataset.id, { filter, replacements, name: name.trim() });
      onSaved(name.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: DownloadFormat, delimiter?: Delimiter) {
    const replacements = buildRules();
    if (!replacements) return;
    setDownloading(true);
    setError(null);
    try {
      const file = await downloadReplace(dataset.id, {
        filter,
        replacements,
        format,
        ...(format === "txt" && delimiter ? { delimiter } : {}),
      });
      saveBlob(file.blob, file.filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {filter ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          La corrección se aplicará solo sobre las filas del filtro activo.
        </p>
      ) : null}
      <div className="space-y-3">
        {drafts.map((draft, index) => {
          const mode = MODES.find((m) => m.value === draft.mode)!;
          return (
            <div key={index} className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="h-8 w-44"
                  value={draft.column}
                  onChange={(event) => updateRule(index, { column: event.target.value })}
                >
                  {columnNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Select
                  className="h-8 w-36"
                  value={draft.mode}
                  onChange={(event) => updateRule(index, { mode: event.target.value as MatchMode })}
                >
                  {MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                    aria-label="Quitar regla"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 flex-1"
                  placeholder="Buscar…"
                  value={draft.search}
                  onChange={(event) => updateRule(index, { search: event.target.value })}
                />
                <span className="text-slate-400">→</span>
                <Input
                  className="h-8 flex-1"
                  placeholder="Reemplazar por… (vacío = borrar)"
                  value={draft.replace}
                  onChange={(event) => updateRule(index, { replace: event.target.value })}
                />
              </div>

              {draft.mode === "exact" ? (
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={draft.caseSensitive}
                    onChange={(event) => updateRule(index, { caseSensitive: event.target.checked })}
                  />
                  Distinguir mayúsculas y minúsculas
                </label>
              ) : (
                <p className="text-xs text-slate-400">{mode.hint}</p>
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDrafts((current) => [...current, newRule(columnNames[0] ?? "")])}
        >
          + Añadir otra regla
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
          Ver resultado
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner /> : null}
          Guardar como archivo
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Descarga todas las filas ya corregidas en tu formato.</p>
        <FormatPicker label="Descargar corregido" downloading={downloading} onDownload={handleDownload} />
      </div>

      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );
}
