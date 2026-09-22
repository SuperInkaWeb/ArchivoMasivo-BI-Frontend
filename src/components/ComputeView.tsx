import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Input, Label, Select } from "@/components/ui/field";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { computeDataset, saveComputed } from "@/services/datasets";
import { errorMessage } from "@/lib/utils";
import type {
  ComputedColumn,
  DatasetDetail,
  Expression,
  FunctionName,
  PreviewResponse,
} from "@/types";

const PAGE_SIZE = 100;

// Funciones expuestas en el editor plano (cada argumento es una columna o un valor).
const FUNCTIONS: Array<{
  value: FunctionName;
  label: string;
  min: number;
  max: number | null;
  hint?: string;
}> = [
  { value: "concat", label: "Unir texto (CONCAT)", min: 2, max: null, hint: "Añade un valor \" \" para separar." },
  { value: "upper", label: "MAYÚSCULAS", min: 1, max: 1 },
  { value: "lower", label: "minúsculas", min: 1, max: 1 },
  { value: "trim", label: "Quitar espacios sobrantes", min: 1, max: 1 },
  { value: "length", label: "Longitud del texto", min: 1, max: 1 },
  { value: "substr", label: "Extraer texto (SUBSTR)", min: 2, max: 3, hint: "texto, inicio[, longitud]" },
  { value: "replace", label: "Reemplazar texto", min: 3, max: 3, hint: "texto, buscar, reemplazo" },
  { value: "add", label: "Sumar (+)", min: 2, max: 2 },
  { value: "sub", label: "Restar (−)", min: 2, max: 2 },
  { value: "mul", label: "Multiplicar (×)", min: 2, max: 2 },
  { value: "div", label: "Dividir (÷)", min: 2, max: 2 },
  { value: "round", label: "Redondear", min: 1, max: 2, hint: "número[, decimales]" },
  { value: "year", label: "Año de una fecha", min: 1, max: 1 },
  { value: "month", label: "Mes de una fecha", min: 1, max: 1 },
  { value: "day", label: "Día de una fecha", min: 1, max: 1 },
  { value: "datediff_days", label: "Días entre dos fechas", min: 2, max: 2, hint: "fecha_a, fecha_b" },
];

const FUNCTION_META = new Map(FUNCTIONS.map((f) => [f.value, f]));

interface ArgDraft {
  source: "column" | "literal";
  column: string;
  literal: string;
}

interface ColumnDraft {
  name: string;
  fn: FunctionName;
  args: ArgDraft[];
}

interface ComputeViewProps {
  dataset: DatasetDetail;
  onSaved: (name: string) => void;
}

function newArg(): ArgDraft {
  return { source: "column", column: "", literal: "" };
}

function newColumnDraft(): ColumnDraft {
  return { name: "", fn: "concat", args: [newArg(), newArg()] };
}

/** Convierte "10.5" a número; deja el resto como texto (para literales de funciones). */
function coerceLiteral(raw: string): string | number {
  const trimmed = raw.trim();
  return trimmed !== "" && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : raw;
}

export function ComputeView({ dataset, onSaved }: ComputeViewProps) {
  const columnNames = dataset.columns.map((column) => column.name);
  const [drafts, setDrafts] = useState<ColumnDraft[]>([newColumnDraft()]);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

      const meta = FUNCTION_META.get(draft.fn)!;
      if (draft.args.length < meta.min || (meta.max !== null && draft.args.length > meta.max)) {
        return fail(`La función "${meta.label}" no tiene el número de argumentos correcto.`);
      }
      const args: Expression[] = [];
      for (const arg of draft.args) {
        if (arg.source === "column") {
          if (!arg.column) return fail(`Elige la columna en "${name}".`);
          args.push({ kind: "column", name: arg.column });
        } else {
          if (arg.literal.trim() === "") return fail(`Escribe el valor en "${name}".`);
          args.push({ kind: "literal", value: coerceLiteral(arg.literal) });
        }
      }
      built.push({ name, expression: { kind: "function", fn: draft.fn, args } });
    }
    return built;
  }

  function fail(message: string): null {
    setError(message);
    return null;
  }

  async function run(offset: number) {
    const columns = validateAndBuild();
    if (!columns) return;
    setLoading(true);
    setError(null);
    try {
      const response = await computeDataset(dataset.id, { filter: null, columns, limit: PAGE_SIZE, offset });
      setResult(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const columns = validateAndBuild();
    if (!columns) return;
    const name = window.prompt("Nombre del archivo nuevo:", `${dataset.original_filename} — con columnas`);
    if (!name || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveComputed(dataset.id, { filter: null, columns, limit: PAGE_SIZE, offset: 0, name: name.trim() });
      onSaved(name.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {drafts.map((draft, index) => {
          const meta = FUNCTION_META.get(draft.fn)!;
          const canAddArg = meta.max === null || draft.args.length < meta.max;
          return (
            <div key={index} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 flex-1"
                  placeholder="Nombre de la columna nueva"
                  value={draft.name}
                  onChange={(event) => updateDraft(index, { name: event.target.value })}
                />
                <Select
                  className="h-8 w-56"
                  value={draft.fn}
                  onChange={(event) => changeFn(index, event.target.value as FunctionName)}
                >
                  {FUNCTIONS.map((option) => (
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
                    aria-label="Quitar columna"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>

              <div className="space-y-2 pl-1">
                {draft.args.map((arg, argIndex) => (
                  <div key={argIndex} className="flex items-center gap-2">
                    <Select
                      className="h-8 w-28"
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
                        className="h-8 flex-1"
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
                        className="h-8 flex-1"
                        placeholder="Valor (texto o número)"
                        value={arg.literal}
                        onChange={(event) => updateArg(index, argIndex, { literal: event.target.value })}
                      />
                    )}
                    {draft.args.length > meta.min ? (
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
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
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => setDrafts((current) => [...current, newColumnDraft()])}>
          + Añadir otra columna
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
        <Label className="!text-slate-400">
          Vista previa (columnas originales + nuevas). Guarda para poder filtrarlas y descargarlas.
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
