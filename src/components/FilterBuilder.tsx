import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterGroupEditor } from "@/components/FilterGroupEditor";
import { createGroup, rootToFilter, type GroupDraft } from "@/lib/filters";
import type { ColumnInfo, FilterGroup } from "@/types";

interface FilterBuilderProps {
  datasetId: string;
  columns: ColumnInfo[];
  applying: boolean;
  onApply: (filter: FilterGroup | null) => void;
}

/** Constructor de filtros con grupos anidados. Posee el árbol raíz de borradores. */
export function FilterBuilder({ datasetId, columns, applying, onApply }: FilterBuilderProps) {
  const [root, setRoot] = useState<GroupDraft>(() => createGroup());

  function apply() {
    onApply(rootToFilter(root, columns));
  }

  function clearAll() {
    setRoot(createGroup());
    onApply(null);
  }

  return (
    <div className="space-y-3">
      {root.children.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Sin condiciones: se incluirán todas las filas. Agrega una condición (o un subgrupo con
          su propio Y/O) para filtrar.
        </p>
      ) : null}

      <FilterGroupEditor
        node={root}
        datasetId={datasetId}
        columns={columns}
        depth={0}
        onChange={setRoot}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button size="sm" onClick={apply} disabled={applying}>
          Aplicar filtros
        </Button>
        {root.children.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={applying}>
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
