import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { FilterRow } from "@/components/FilterRow";
import { createDraft, toFilterCondition, type ConditionDraft } from "@/lib/filters";
import type { ColumnInfo, Combinator, FilterCondition } from "@/types";

interface FilterBuilderProps {
  columns: ColumnInfo[];
  applying: boolean;
  onApply: (conditions: FilterCondition[], combinator: Combinator) => void;
}

export function FilterBuilder({ columns, applying, onApply }: FilterBuilderProps) {
  const [drafts, setDrafts] = useState<ConditionDraft[]>([]);
  const [combinator, setCombinator] = useState<Combinator>("and");

  const firstColumn = columns[0]?.name ?? "";

  function addCondition() {
    setDrafts((current) => [...current, createDraft(firstColumn)]);
  }

  function updateDraft(next: ConditionDraft) {
    setDrafts((current) => current.map((draft) => (draft.id === next.id ? next : draft)));
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  function apply() {
    onApply(
      drafts.map((draft) => toFilterCondition(draft, columns)),
      combinator,
    );
  }

  function clearAll() {
    setDrafts([]);
    onApply([], combinator);
  }

  return (
    <div className="space-y-3">
      {drafts.length > 1 ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Combinar con</span>
          <Select
            className="h-8 w-28"
            value={combinator}
            onChange={(event) => setCombinator(event.target.value as Combinator)}
          >
            <option value="and">Y (todas)</option>
            <option value="or">O (alguna)</option>
          </Select>
        </div>
      ) : null}

      {drafts.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Sin condiciones: se incluirán todas las filas. Agrega una condición para filtrar.
        </p>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <FilterRow
              key={draft.id}
              draft={draft}
              columns={columns}
              onChange={updateDraft}
              onRemove={removeDraft}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={addCondition}>
          + Agregar condición
        </Button>
        <Button size="sm" onClick={apply} disabled={applying}>
          Aplicar filtros
        </Button>
        {drafts.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={applying}>
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
