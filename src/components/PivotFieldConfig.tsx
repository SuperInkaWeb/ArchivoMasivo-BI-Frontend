import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Select } from "@/components/ui/field";
import type { Aggregation, Measure } from "@/types";

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: "count", label: "Conteo" },
  { value: "count_distinct", label: "Conteo único" },
  { value: "sum", label: "Suma" },
  { value: "avg", label: "Promedio" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
];

/** Campo arrastrable de la lista de origen. */
function FieldChip({ name }: { name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: name });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={
        "cursor-grab touch-none rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-emerald-300 active:cursor-grabbing " +
        (isDragging ? "opacity-60" : "")
      }
    >
      {name}
    </button>
  );
}

/** Ficha colocada en una zona, con botón para quitarla. */
function ZoneChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${label}`}
        className="text-emerald-600 hover:text-red-600"
      >
        ×
      </button>
    </span>
  );
}

/** Zona soltable (Filas / Columnas / Valores). */
function DropZone({
  id,
  title,
  hint,
  empty,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{title}</span>
        <span className="text-[10px] text-slate-400">{hint}</span>
      </div>
      <div
        ref={setNodeRef}
        className={
          "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-dashed p-1.5 " +
          (isOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200")
        }
      >
        {empty ? <span className="px-1 text-[11px] text-slate-300">Arrastra un campo aquí</span> : children}
      </div>
    </div>
  );
}

interface PivotFieldConfigProps {
  columns: string[];
  groupBy: string[];
  setGroupBy: Dispatch<SetStateAction<string[]>>;
  measures: Measure[];
  setMeasures: Dispatch<SetStateAction<Measure[]>>;
  pivotColumn: string;
  setPivotColumn: Dispatch<SetStateAction<string>>;
}

/** Configuración del pivote arrastrando campos a las zonas, estilo Excel. */
export function PivotFieldConfig({
  columns,
  groupBy,
  setGroupBy,
  measures,
  setMeasures,
  pivotColumn,
  setPivotColumn,
}: PivotFieldConfigProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(event: DragEndEvent) {
    const name = String(event.active.id);
    const zone = event.over?.id;
    if (!zone) return;
    if (zone === "rows") {
      setGroupBy((current) => (current.includes(name) ? current : [...current, name]));
    } else if (zone === "cols") {
      setPivotColumn(name);
    } else if (zone === "values") {
      setMeasures((current) => [...current, { column: name, aggregation: "sum" }]);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="mb-2 text-xs font-medium text-slate-500">Campos</p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((name) => (
              <FieldChip key={name} name={name} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Arrastra un campo a una zona.</p>
        </div>

        <div className="space-y-2">
          <DropZone id="rows" title="Filas" hint="agrupar por" empty={groupBy.length === 0}>
            {groupBy.map((name) => (
              <ZoneChip
                key={name}
                label={name}
                onRemove={() => setGroupBy((current) => current.filter((item) => item !== name))}
              />
            ))}
          </DropZone>

          <DropZone id="cols" title="Columnas" hint="cross-tab · una" empty={!pivotColumn}>
            {pivotColumn ? <ZoneChip label={pivotColumn} onRemove={() => setPivotColumn("")} /> : null}
          </DropZone>

          <DropZone id="values" title="Valores" hint="métricas" empty={measures.length === 0}>
            {measures.map((measure, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5"
              >
                <Select
                  className="!h-6 w-24 !text-xs"
                  value={measure.aggregation}
                  onChange={(event) =>
                    setMeasures((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, aggregation: event.target.value as Aggregation } : item,
                      ),
                    )
                  }
                >
                  {AGGREGATIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-slate-700">{measure.column ?? "filas"}</span>
                <button
                  type="button"
                  onClick={() => setMeasures((current) => current.filter((_, i) => i !== index))}
                  aria-label="Quitar métrica"
                  className="text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setMeasures((current) => [...current, { aggregation: "count" }])}
              className="rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-emerald-400"
            >
              + Conteo de filas
            </button>
          </DropZone>
        </div>
      </div>
    </DndContext>
  );
}
