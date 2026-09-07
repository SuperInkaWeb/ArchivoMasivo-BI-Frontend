import { Input, Select } from "@/components/ui/field";
import { OPERATOR_OPTIONS, operatorValueKind, type ConditionDraft } from "@/lib/filters";
import type { ColumnInfo, Operator } from "@/types";

interface FilterRowProps {
  draft: ConditionDraft;
  columns: ColumnInfo[];
  onChange: (draft: ConditionDraft) => void;
  onRemove: (id: string) => void;
}

export function FilterRow({ draft, columns, onChange, onRemove }: FilterRowProps) {
  const kind = operatorValueKind(draft.operator);

  return (
    <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2">
      <Select
        value={draft.column}
        onChange={(event) => onChange({ ...draft, column: event.target.value })}
      >
        {columns.map((column) => (
          <option key={column.name} value={column.name}>
            {column.name}
          </option>
        ))}
      </Select>

      <Select
        value={draft.operator}
        onChange={(event) => onChange({ ...draft, operator: event.target.value as Operator })}
      >
        {OPERATOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {kind === "none" ? (
        <span className="px-1 text-xs text-slate-400">sin valor</span>
      ) : (
        <Input
          value={draft.raw}
          placeholder={placeholderFor(kind)}
          onChange={(event) => onChange({ ...draft, raw: event.target.value })}
        />
      )}

      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
        onClick={() => onRemove(draft.id)}
        aria-label="Quitar condición"
      >
        ✕
      </button>
    </div>
  );
}

function placeholderFor(kind: ReturnType<typeof operatorValueKind>): string {
  if (kind === "list") return "valor1, valor2, valor3";
  if (kind === "range") return "desde, hasta";
  return "valor";
}
