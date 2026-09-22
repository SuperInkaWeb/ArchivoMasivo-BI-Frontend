interface FormulaBarProps {
  /** Referencia de la celda activa, p. ej. "B5" (vacío si no hay selección). */
  cellRef: string;
  /** Valor de la celda activa (solo lectura: los datos viven en el servidor). */
  value: string;
}

/** Cuadro de nombres + barra de fórmulas, como la de Excel (aquí, solo lectura). */
export function FormulaBar({ cellRef, value }: FormulaBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex h-8 w-16 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-600">
        {cellRef || "—"}
      </div>
      <span className="select-none text-xs italic text-slate-400">fx</span>
      <div className="flex h-8 flex-1 items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
