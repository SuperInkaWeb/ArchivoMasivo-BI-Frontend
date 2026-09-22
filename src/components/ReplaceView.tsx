import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { FormatPicker } from "@/components/FormatPicker";
import { Input, Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { downloadReplace, replaceDataset, saveReplace } from "@/services/datasets";
import { errorMessage, formatNumber, saveBlob } from "@/lib/utils";
import type {
  DatasetDetail,
  Delimiter,
  DownloadFormat,
  MatchMode,
  PreviewResponse,
  ReplacementRule,
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
  onSaved: (name: string) => void;
}

function newRule(firstColumn: string): RuleDraft {
  return { column: firstColumn, mode: "exact", search: "", replace: "", caseSensitive: true };
}

export function ReplaceView({ dataset, onSaved }: ReplaceViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [drafts, setDrafts] = useState<RuleDraft[]>([newRule(columnNames[0] ?? "")]);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
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

  async function run(offset: number) {
    const replacements = buildRules();
    if (!replacements) return;
    setLoading(true);
    setError(null);
    try {
      const response = await replaceDataset(dataset.id, { filter: null, replacements, limit: PAGE_SIZE, offset });
      setResult(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const replacements = buildRules();
    if (!replacements) return;
    const name = window.prompt("Nombre del archivo corregido:", `${dataset.original_filename} — corregido`);
    if (!name || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveReplace(dataset.id, { filter: null, replacements, name: name.trim() });
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
        filter: null,
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
      <div className="space-y-3">
        {drafts.map((draft, index) => {
          const mode = MODES.find((m) => m.value === draft.mode)!;
          return (
            <div key={index} className="space-y-2 rounded-lg border border-slate-200 p-3">
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

      <div className="flex items-center gap-2">
        <Button onClick={() => run(0)} disabled={loading}>
          {loading ? <Spinner className="border-white/40 border-t-white" /> : null}
          Ver resultado
        </Button>
        {result ? (
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            Guardar como archivo
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {result ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            Descarga todas las filas ({formatNumber(result.total_matched)}) ya corregidas.
          </p>
          <FormatPicker label="Descargar corregido" downloading={downloading} onDownload={handleDownload} />
        </div>
      ) : null}
      {result ? (
        <Label className="!text-slate-400">
          Vista previa con las correcciones aplicadas. Guárdala como archivo para reutilizarla y filtrarla.
        </Label>
      ) : null}
      {result ? (
        <DataTable
          columns={result.columns}
          rows={result.rows}
          total={result.total_matched}
          limit={result.limit}
          offset={result.offset}
          loading={loading}
          onPageChange={(next) => run(next)}
        />
      ) : null}
    </div>
  );
}
