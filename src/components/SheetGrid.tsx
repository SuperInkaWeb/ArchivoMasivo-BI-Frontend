import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { FormulaBar } from "@/components/FormulaBar";
import { StatusBar, type SelectionStats } from "@/components/StatusBar";
import { cleanNumber } from "@/lib/utils";
import { useSheetData } from "@/hooks/useSheetData";
import type { FilterGroup, SortSpec } from "@/types";

const ROW_HEIGHT = 30;
const COL_WIDTH = 150;
const GUTTER_WIDTH = 56;
// Tope de celdas a agregar en la selección (evita recorrer rangos gigantes).
const MAX_SELECTION_AGG = 50_000;

interface Cell {
  row: number;
  col: number;
}

/** Índice de columna a letra estilo hoja de cálculo (0 -> A, 26 -> AA). */
function columnLetter(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "verdadero" : "falso";
  if (typeof value === "number") return cleanNumber(value);
  return String(value);
}

function sortIndicator(column: string, sort: SortSpec | null): string {
  if (!sort || sort.column !== column) return "↕";
  return sort.direction === "asc" ? "▲" : "▼";
}

interface SheetGridProps {
  datasetId: string;
  filter: FilterGroup | null;
  sort: SortSpec | null;
  ready: boolean;
  search: string;
  onSort: (column: string) => void;
  onTotalChange: (total: number | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  loadingLabel?: string;
}

export function SheetGrid({
  datasetId,
  filter,
  sort,
  ready,
  search,
  onSort,
  onTotalChange,
  onLoadingChange,
  loadingLabel,
}: SheetGridProps) {
  const { columns, total, rowCount, capped, loading, error, getRow, ensureRange } = useSheetData(
    datasetId,
    filter,
    sort,
    ready,
    search,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [active, setActive] = useState<Cell | null>(null);

  useEffect(() => {
    onTotalChange(total);
  }, [total, onTotalChange]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    if (items.length > 0) ensureRange(items[0].index, items[items.length - 1].index);
  }, [items, ensureRange]);

  // Vuelve al inicio y limpia la selección al cambiar dataset / filtro / orden.
  const resetKey = `${datasetId}|${JSON.stringify(filter)}|${sort ? `${sort.column}:${sort.direction}` : ""}|${search}`;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    virtualizer.scrollToOffset(0);
    setAnchor(null);
    setActive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  function selectCell(row: number, col: number, extend: boolean) {
    setActive({ row, col });
    if (!extend || !anchor) setAnchor({ row, col });
  }

  const rect =
    anchor && active
      ? {
          r0: Math.min(anchor.row, active.row),
          r1: Math.max(anchor.row, active.row),
          c0: Math.min(anchor.col, active.col),
          c1: Math.max(anchor.col, active.col),
        }
      : null;

  const selection = useMemo<SelectionStats | null>(() => {
    if (!rect) return null;
    const area = (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1);
    if (area <= 1 || area > MAX_SELECTION_AGG) return null;
    let count = 0;
    let sum = 0;
    let numeric = 0;
    for (let r = rect.r0; r <= rect.r1; r += 1) {
      const row = getRow(r);
      if (!row) continue;
      for (let c = rect.c0; c <= rect.c1; c += 1) {
        const value = row[columns[c]];
        if (value === null || value === undefined || value === "") continue;
        count += 1;
        if (typeof value !== "boolean") {
          const parsed = typeof value === "number" ? value : Number(value);
          if (!Number.isNaN(parsed)) {
            sum += parsed;
            numeric += 1;
          }
        }
      }
    }
    return { count, sum: numeric > 0 ? sum : null, average: numeric > 0 ? sum / numeric : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect?.r0, rect?.r1, rect?.c0, rect?.c1, columns, getRow]);

  const activeRow = active ? getRow(active.row) : undefined;
  const activeRef = active ? `${columnLetter(active.col)}${active.row + 1}` : "";
  const activeValue = active && activeRow ? renderCell(activeRow[columns[active.col]]) : "";

  const contentWidth = GUTTER_WIDTH + columns.length * COL_WIDTH;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <FormulaBar cellRef={activeRef} value={activeValue} />

      {error ? <ErrorBanner message={error} /> : null}

      <div
        ref={scrollRef}
        className="thin-scroll relative min-h-0 flex-1 overflow-auto rounded-lg border border-slate-300"
      >
        {!ready ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Spinner /> Preparando el archivo…
          </div>
        ) : loading && columns.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Spinner /> {loadingLabel ?? "Cargando…"}
          </div>
        ) : columns.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Ninguna fila coincide con el filtro.</div>
        ) : (
          <div style={{ width: contentWidth }}>
            <div className="sticky top-0 z-20 flex">
              <div
                className="sticky left-0 z-30 border-b border-r border-slate-300 bg-slate-100"
                style={{ width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH }}
              />
              {columns.map((column, index) => (
                <button
                  key={column}
                  type="button"
                  onClick={() => onSort(column)}
                  title="Ordenar por esta columna"
                  className="flex flex-col items-stretch border-b border-r border-slate-300 text-left hover:bg-emerald-100/60"
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH, backgroundColor: "#eaf3ee" }}
                >
                  <span className="border-b border-emerald-200/70 px-2 py-0.5 text-center text-[10px] text-emerald-700/70">
                    {columnLetter(index)}
                  </span>
                  <span className="flex items-center justify-between gap-1 px-2 py-1">
                    <span className="truncate text-xs font-medium text-emerald-900">{column}</span>
                    <span className="text-[10px] text-emerald-700/60">{sortIndicator(column, sort)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {items.map((item) => {
                const row = getRow(item.index);
                const rowInRange = rect ? item.index >= rect.r0 && item.index <= rect.r1 : false;
                return (
                  <div
                    key={item.index}
                    className="absolute left-0 flex"
                    style={{ top: 0, transform: `translateY(${item.start}px)`, height: ROW_HEIGHT }}
                  >
                    <div
                      className={
                        "sticky left-0 z-10 flex items-center justify-center border-b border-r border-slate-200 text-[11px] " +
                        (rowInRange ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-400")
                      }
                      style={{ width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH }}
                    >
                      {item.index + 1}
                    </div>
                    {columns.map((column, colIndex) => {
                      const inRange =
                        rect &&
                        item.index >= rect.r0 &&
                        item.index <= rect.r1 &&
                        colIndex >= rect.c0 &&
                        colIndex <= rect.c1;
                      const isActive = active?.row === item.index && active?.col === colIndex;
                      return (
                        <div
                          key={column}
                          onClick={(event) => selectCell(item.index, colIndex, event.shiftKey)}
                          className={
                            "flex cursor-cell items-center overflow-hidden whitespace-nowrap border-b border-r border-slate-200 px-2 text-xs text-slate-700 " +
                            (isActive
                              ? "z-10 bg-emerald-50 ring-2 ring-inset ring-emerald-500"
                              : inRange
                                ? "bg-emerald-50"
                                : "bg-white")
                          }
                          style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                        >
                          {row ? (
                            <span className="truncate">{renderCell(row[column])}</span>
                          ) : (
                            <span className="text-slate-300">·</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <StatusBar total={total} capped={capped} loading={loading} selection={selection} />
    </div>
  );
}
