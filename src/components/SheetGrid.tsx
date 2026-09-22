import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ErrorBanner, Spinner } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";
import { MAX_SHEET_ROWS, useSheetData } from "@/hooks/useSheetData";
import type { FilterGroup, SortSpec } from "@/types";

const ROW_HEIGHT = 30;
const COL_WIDTH = 150;
const GUTTER_WIDTH = 56;

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
  );
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Vuelve al inicio cuando cambian dataset / filtro / orden (los datos se reinician).
  const resetKey = `${datasetId}|${JSON.stringify(filter)}|${sort ? `${sort.column}:${sort.direction}` : ""}`;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    virtualizer.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const contentWidth = GUTTER_WIDTH + columns.length * COL_WIDTH;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{total != null ? formatNumber(total) : "…"}</strong> filas
          {loading ? <Spinner className="ml-2 inline-block h-3 w-3 align-middle" /> : null}
        </span>
        {capped ? (
          <span className="text-amber-600">
            En pantalla: primeras {formatNumber(MAX_SHEET_ROWS)} · filtra o descarga para el resto
          </span>
        ) : null}
      </div>

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
                return (
                  <div
                    key={item.index}
                    className="absolute left-0 flex"
                    style={{ top: 0, transform: `translateY(${item.start}px)`, height: ROW_HEIGHT }}
                  >
                    <div
                      className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-slate-200 bg-slate-50 text-[11px] text-slate-400"
                      style={{ width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH }}
                    >
                      {item.index + 1}
                    </div>
                    {columns.map((column) => (
                      <div
                        key={column}
                        className="flex items-center overflow-hidden whitespace-nowrap border-b border-r border-slate-200 bg-white px-2 text-xs text-slate-700"
                        style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                      >
                        {row ? (
                          <span className="truncate">{renderCell(row[column])}</span>
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
