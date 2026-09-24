import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormatPicker } from "@/components/FormatPicker";
import { SaveAsDialog } from "@/components/SaveAsDialog";
import { Input, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { computeDataset, downloadComputed, saveComputed } from "@/services/datasets";
import { errorMessage, saveBlob } from "@/lib/utils";
import type {
  ComputedColumn,
  DatasetDetail,
  Delimiter,
  DownloadFormat,
  Expression,
  FilterGroup,
  FunctionName,
  PreviewResponse,
  ToolPreviewOptions,
} from "@/types";

const PAGE_SIZE = 100;

// Funciones expuestas en el editor plano (cada argumento es una columna o un valor).
interface FunctionMeta {
  value: FunctionName;
  label: string;
  min: number;
  max: number | null;
  argLabels: string[]; // nombre de cada argumento (para funciones con más args se repite el último)
  hint?: string;
}

const FUNCTIONS: FunctionMeta[] = [
  { value: "concat", label: "Unir texto (CONCAT)", min: 2, max: null, argLabels: ["Parte"], hint: 'Añade un "Valor fijo" con un espacio " " para separar.' },
  { value: "upper", label: "MAYÚSCULAS", min: 1, max: 1, argLabels: ["Texto"] },
  { value: "lower", label: "minúsculas", min: 1, max: 1, argLabels: ["Texto"] },
  { value: "trim", label: "Quitar espacios sobrantes", min: 1, max: 1, argLabels: ["Texto"] },
  { value: "length", label: "Longitud del texto", min: 1, max: 1, argLabels: ["Texto"] },
  { value: "substr", label: "Extraer texto (SUBSTR)", min: 2, max: 3, argLabels: ["Texto", "Inicio", "Longitud"] },
  { value: "replace", label: "Reemplazar texto", min: 3, max: 3, argLabels: ["Texto", "Buscar", "Reemplazo"] },
  { value: "add", label: "Sumar (+)", min: 2, max: 2, argLabels: ["Valor A", "Valor B"] },
  { value: "sub", label: "Restar (−)", min: 2, max: 2, argLabels: ["Valor A", "Valor B"] },
  { value: "mul", label: "Multiplicar (×)", min: 2, max: 2, argLabels: ["Valor A", "Valor B"] },
  { value: "div", label: "Dividir (÷)", min: 2, max: 2, argLabels: ["Dividendo", "Divisor"] },
  { value: "round", label: "Redondear", min: 1, max: 2, argLabels: ["Número", "Decimales"] },
  { value: "year", label: "Año de una fecha", min: 1, max: 1, argLabels: ["Fecha"] },
  { value: "month", label: "Mes de una fecha", min: 1, max: 1, argLabels: ["Fecha"] },
  { value: "day", label: "Día de una fecha", min: 1, max: 1, argLabels: ["Fecha"] },
  { value: "datediff_days", label: "Días entre dos fechas", min: 2, max: 2, argLabels: ["Fecha A", "Fecha B"] },
  { value: "if", label: "Condición SI (si… entonces… si no…)", min: 4, max: 4, argLabels: ["Izquierda", "Derecha", "Entonces", "Si no"] },
];

// Comparadores disponibles para la condición del SI (subconjunto de FunctionName).
const COMPARATORS: Array<{ value: FunctionName; label: string }> = [
  { value: "eq", label: "= igual a" },
  { value: "ne", label: "≠ distinto de" },
  { value: "gt", label: "> mayor que" },
  { value: "gte", label: "≥ mayor o igual que" },
  { value: "lt", label: "< menor que" },
  { value: "lte", label: "≤ menor o igual que" },
];

const COMPARATOR_SYMBOL: Partial<Record<FunctionName, string>> = {
  eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤",
};

const FUNCTION_META = new Map(FUNCTIONS.map((f) => [f.value, f]));

/** Etiqueta del argumento en la posición `index` (numera cuando la función acepta varios). */
function argLabel(meta: FunctionMeta, index: number): string {
  if (index < meta.argLabels.length) return meta.argLabels[index];
  const last = meta.argLabels[meta.argLabels.length - 1] ?? "Valor";
  return `${last} ${index + 1}`;
}

// Operadores que se muestran en infijo (A + B) y nombre corto del resto para el preview.
const INFIX_TOKENS: Partial<Record<FunctionName, string>> = { add: "+", sub: "−", mul: "×", div: "÷" };
const FN_TOKENS: Partial<Record<FunctionName, string>> = {
  concat: "UNIR", upper: "MAYÚS", lower: "minús", trim: "LIMPIAR", length: "LARGO",
  substr: "EXTRAER", replace: "REEMPLAZAR", round: "REDONDEAR",
  year: "AÑO", month: "MES", day: "DÍA", datediff_days: "DÍAS_ENTRE",
};

/** Texto legible de un argumento para el preview (columna, número o "texto"). */
function argText(arg: ArgDraft | undefined): string {
  if (!arg) return "?";
  if (arg.source === "column") return arg.column || "?";
  if (arg.literal.trim() === "") return "?";
  const value = coerceLiteral(arg.literal);
  return typeof value === "number" ? String(value) : `"${arg.literal}"`;
}

/** Fórmula legible de una columna calculada, p. ej. `Total = column03 × 1.18`. */
function previewFormula(draft: ColumnDraft): string {
  const name = draft.name.trim() || "(sin nombre)";
  if (draft.fn === "if") {
    const symbol = COMPARATOR_SYMBOL[draft.comparator] ?? "?";
    const [left, right, thenArg, elseArg] = draft.args;
    return `${name} = SI(${argText(left)} ${symbol} ${argText(right)}, ${argText(thenArg)}, ${argText(elseArg)})`;
  }
  const parts = draft.args.map(argText);
  const infix = INFIX_TOKENS[draft.fn];
  if (infix && parts.length >= 2) return `${name} = ${parts.join(` ${infix} `)}`;
  const token = FN_TOKENS[draft.fn] ?? draft.fn;
  return `${name} = ${token}(${parts.join(", ")})`;
}

interface ArgDraft {
  source: "column" | "literal";
  column: string;
  literal: string;
}

interface ColumnDraft {
  name: string;
  fn: FunctionName;
  args: ArgDraft[];
  comparator: FunctionName; // solo se usa cuando fn === "if"
}

interface ComputeViewProps {
  dataset: DatasetDetail;
  filter: FilterGroup | null; // filtro activo: las columnas se calculan solo sobre esas filas
  busy: boolean;
  onPreview: (fetcher: (offset: number) => Promise<PreviewResponse>, options: ToolPreviewOptions) => void;
  onSaved: (name: string) => void;
}

function newArg(): ArgDraft {
  return { source: "column", column: "", literal: "" };
}

function newColumnDraft(): ColumnDraft {
  return { name: "", fn: "concat", args: [newArg(), newArg()], comparator: "gt" };
}

/**
 * Convierte "10.5" a número, pero deja como texto lo que no representa el mismo
 * número al volver a texto (p. ej. "08" -> queda "08", no 8). Así se preservan
 * códigos con ceros a la izquierda al unir texto.
 */
function coerceLiteral(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed === "") return raw;
  const asNumber = Number(trimmed);
  return !Number.isNaN(asNumber) && String(asNumber) === trimmed ? asNumber : raw;
}

export function ComputeView({ dataset, filter, busy, onPreview, onSaved }: ComputeViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [drafts, setDrafts] = useState<ColumnDraft[]>([newColumnDraft()]);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(index: number, patch: Partial<ColumnDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function updateArg(colIndex: number, argIndex: number, patch: Partial<ArgDraft>) {
    setDrafts((current) =>
      current.map((draft, i) =>
        i === colIndex
          ? { ...draft, args: draft.args.map((arg, j) => (j === argIndex ? { ...arg, ...patch } : arg)) }
          : draft,
      ),
    );
  }

  function changeFn(index: number, fn: FunctionName) {
    const meta = FUNCTION_META.get(fn)!;
    setDrafts((current) =>
      current.map((draft, i) => {
        if (i !== index) return draft;
        const args = [...draft.args];
        while (args.length < meta.min) args.push(newArg());
        if (meta.max !== null && args.length > meta.max) args.length = meta.max;
        return { ...draft, fn, args };
      }),
    );
  }

  function validateAndBuild(): ComputedColumn[] | null {
    const names = new Set<string>();
    const built: ComputedColumn[] = [];
    for (const draft of drafts) {
      const name = draft.name.trim();
      if (!name) return fail("Cada columna nueva necesita un nombre.");
      if (columnNames.includes(name)) return fail(`Ya existe una columna llamada "${name}".`);
      if (names.has(name)) return fail(`Nombre de columna repetido: "${name}".`);
      names.add(name);

      const toExpr = (arg: ArgDraft | undefined): Expression | null => {
        if (!arg) return fail(`Falta un valor en "${name}".`);
        if (arg.source === "column") {
          if (!arg.column) return fail(`Elige la columna en "${name}".`);
          return { kind: "column", name: arg.column };
        }
        if (arg.literal.trim() === "") return fail(`Escribe el valor en "${name}".`);
        return { kind: "literal", value: coerceLiteral(arg.literal) };
      };

      if (draft.fn === "if") {
        const left = toExpr(draft.args[0]);
        const right = toExpr(draft.args[1]);
        const thenExpr = toExpr(draft.args[2]);
        const elseExpr = toExpr(draft.args[3]);
        if (!left || !right || !thenExpr || !elseExpr) return null;
        const condition: Expression = { kind: "function", fn: draft.comparator, args: [left, right] };
        built.push({
          name,
          expression: { kind: "function", fn: "if", args: [condition, thenExpr, elseExpr] },
        });
        continue;
      }

      const meta = FUNCTION_META.get(draft.fn)!;
      if (draft.args.length < meta.min || (meta.max !== null && draft.args.length > meta.max)) {
        return fail(`La función "${meta.label}" no tiene el número de argumentos correcto.`);
      }
      const args: Expression[] = [];
      for (const arg of draft.args) {
        const expr = toExpr(arg);
        if (!expr) return null;
        args.push(expr);
      }
      built.push({ name, expression: { kind: "function", fn: draft.fn, args } });
    }
    return built;
  }

  function fail(message: string): null {
    setError(message);
    return null;
  }

  function generate() {
    const columns = validateAndBuild();
    if (!columns) return;
    setError(null);
    onPreview((offset) => computeDataset(dataset.id, { filter, columns, limit: PAGE_SIZE, offset }), {
      download: handleDownload,
      save: openSave,
    });
  }

  function openSave() {
    if (!validateAndBuild()) return;
    setSaveOpen(true);
  }

  async function doSave(name: string) {
    const columns = validateAndBuild();
    if (!columns) return;
    setSaving(true);
    setError(null);
    try {
      await saveComputed(dataset.id, { filter, columns, limit: PAGE_SIZE, offset: 0, name });
      onSaved(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: DownloadFormat, delimiter?: Delimiter) {
    const columns = validateAndBuild();
    if (!columns) return;
    setDownloading(true);
    setError(null);
    try {
      const file = await downloadComputed(dataset.id, {
        filter,
        columns,
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
          Las columnas se calcularán solo sobre las filas del filtro activo.
        </p>
      ) : null}
      <div className="space-y-3">
        {drafts.map((draft, index) => {
          const meta = FUNCTION_META.get(draft.fn)!;
          const canAddArg = meta.max === null || draft.args.length < meta.max;
          const isIf = draft.fn === "if";
          // Controles de un argumento (origen columna/valor + su editor), reutilizados por ambos editores.
          const argFields = (argIndex: number) => {
            const arg = draft.args[argIndex];
            if (!arg) return null;
            return (
              <>
                <Select
                  className="w-32"
                  value={arg.source}
                  onChange={(event) =>
                    updateArg(index, argIndex, { source: event.target.value as ArgDraft["source"] })
                  }
                >
                  <option value="column">Columna</option>
                  <option value="literal">Valor fijo</option>
                </Select>
                {arg.source === "column" ? (
                  <Select
                    className="flex-1"
                    value={arg.column}
                    onChange={(event) => updateArg(index, argIndex, { column: event.target.value })}
                  >
                    <option value="">Elige columna…</option>
                    {columnNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="flex-1"
                    placeholder="Texto o número"
                    value={arg.literal}
                    onChange={(event) => updateArg(index, argIndex, { literal: event.target.value })}
                  />
                )}
              </>
            );
          };
          return (
            <div key={index} className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[200px] flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    Nombre de la columna nueva
                  </span>
                  <Input
                    placeholder="p. ej. Nombre completo"
                    value={draft.name}
                    onChange={(event) => updateDraft(index, { name: event.target.value })}
                  />
                </label>
                <label className="w-56">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Función</span>
                  <Select
                    value={draft.fn}
                    onChange={(event) => changeFn(index, event.target.value as FunctionName)}
                  >
                    {FUNCTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    className="mb-1 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                    aria-label="Quitar columna"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>

              {isIf ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-500">Si se cumple la condición…</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {argFields(0)}
                      <Select
                        className="w-48"
                        value={draft.comparator}
                        onChange={(event) =>
                          updateDraft(index, { comparator: event.target.value as FunctionName })
                        }
                      >
                        {COMPARATORS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      {argFields(1)}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-500">Entonces (si se cumple)</span>
                      <div className="flex items-center gap-2">{argFields(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-500">Si no (si no se cumple)</span>
                      <div className="flex items-center gap-2">{argFields(3)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {draft.args.map((_, argIndex) => (
                    <div key={argIndex} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                        {argLabel(meta, argIndex)}
                      </span>
                      {argFields(argIndex)}
                      {draft.args.length > meta.min ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() =>
                            setDrafts((current) =>
                              current.map((d, i) =>
                                i === index ? { ...d, args: d.args.filter((_, j) => j !== argIndex) } : d,
                              ),
                            )
                          }
                          aria-label="Quitar argumento"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canAddArg ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDrafts((current) =>
                          current.map((d, i) => (i === index ? { ...d, args: [...d.args, newArg()] } : d)),
                        )
                      }
                    >
                      + argumento
                    </Button>
                  ) : null}
                  {meta.hint ? <p className="text-xs text-slate-400">{meta.hint}</p> : null}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Fórmula
                </span>
                <code className="truncate font-mono text-[11px] text-slate-700">
                  {previewFormula(draft)}
                </code>
              </div>
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => setDrafts((current) => [...current, newColumnDraft()])}>
          + Añadir otra columna
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
          Ver resultado
        </Button>
        <Button variant="secondary" onClick={openSave} disabled={saving}>
          {saving ? <Spinner /> : null}
          Guardar como archivo
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Descarga todas las filas con las columnas nuevas.</p>
        <FormatPicker label="Descargar columnas" downloading={downloading} onDownload={handleDownload} />
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <SaveAsDialog
        open={saveOpen}
        title="Guardar archivo con columnas"
        defaultName={`${dataset.original_filename} — con columnas`}
        onCancel={() => setSaveOpen(false)}
        onConfirm={(name) => {
          setSaveOpen(false);
          doSave(name);
        }}
      />
    </div>
  );
}
