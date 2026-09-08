import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { FilterRow } from "@/components/FilterRow";
import { createGroup, createLeaf, type GroupDraft, type NodeDraft } from "@/lib/filters";
import type { ColumnInfo, Combinator } from "@/types";

const MAX_DEPTH = 5; // alineado con el límite del backend (evita anidamiento excesivo)

interface FilterGroupEditorProps {
  node: GroupDraft;
  datasetId: string;
  columns: ColumnInfo[];
  depth: number;
  onChange: (node: GroupDraft) => void;
  onRemove?: (id: string) => void; // ausente en la raíz
}

/** Editor recursivo de un grupo de filtros (conector AND/OR + hijos anidables). */
export function FilterGroupEditor({
  node,
  datasetId,
  columns,
  depth,
  onChange,
  onRemove,
}: FilterGroupEditorProps) {
  const firstColumn = columns[0]?.name ?? "";

  function updateChild(updated: NodeDraft) {
    onChange({ ...node, children: node.children.map((child) => (child.id === updated.id ? updated : child)) });
  }

  function removeChild(id: string) {
    onChange({ ...node, children: node.children.filter((child) => child.id !== id) });
  }

  const isRoot = depth === 0;

  return (
    <div
      className={
        isRoot
          ? "space-y-2"
          : "space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        {node.children.length > 1 ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Combinar con</span>
            <Select
              className="h-8 w-28"
              value={node.combinator}
              onChange={(event) => onChange({ ...node, combinator: event.target.value as Combinator })}
            >
              <option value="and">Y (todas)</option>
              <option value="or">O (alguna)</option>
            </Select>
          </div>
        ) : (
          <span className="text-xs text-slate-400">{isRoot ? "" : "Grupo"}</span>
        )}
        {onRemove ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => onRemove(node.id)}
          >
            Quitar grupo
          </button>
        ) : null}
      </div>

      {node.children.length === 0 ? (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-400">
          Grupo vacío: agrega una condición o un subgrupo.
        </p>
      ) : (
        <div className="space-y-2">
          {node.children.map((child) =>
            child.type === "condition" ? (
              <FilterRow
                key={child.id}
                datasetId={datasetId}
                draft={child}
                columns={columns}
                onChange={updateChild}
                onRemove={removeChild}
              />
            ) : (
              <FilterGroupEditor
                key={child.id}
                node={child}
                datasetId={datasetId}
                columns={columns}
                depth={depth + 1}
                onChange={updateChild}
                onRemove={removeChild}
              />
            ),
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange({ ...node, children: [...node.children, createLeaf(firstColumn)] })}
        >
          + Condición
        </Button>
        {depth < MAX_DEPTH ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...node, children: [...node.children, createGroup()] })}
          >
            + Subgrupo ( )
          </Button>
        ) : null}
      </div>
    </div>
  );
}
