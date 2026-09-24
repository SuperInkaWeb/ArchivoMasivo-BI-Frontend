import type { ReactNode } from "react";

export type WorkspaceMode = "filter" | "pivot" | "compute" | "replace" | "dedupe" | "stats" | "chart";

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FilterIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 4h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M9 4v16" />
    </svg>
  );
}

function FxIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2H6" />
      <path d="M6 12h8M15 10l5 6M20 10l-5 6" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h11l-3-3M20 17H9l3 3" />
    </svg>
  );
}

function DedupeIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="10" height="10" rx="1.5" />
      <path d="M10 10h10v10H10" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5h9M4 12h16M4 19h6" />
    </svg>
  );
}

const COMMANDS: Array<{ mode: WorkspaceMode; label: string; icon: ReactNode }> = [
  { mode: "filter", label: "Filtrar", icon: <FilterIcon /> },
  { mode: "pivot", label: "Tabla dinámica", icon: <TableIcon /> },
  { mode: "compute", label: "Columnas calculadas", icon: <FxIcon /> },
  { mode: "replace", label: "Buscar y reemplazar", icon: <ReplaceIcon /> },
  { mode: "dedupe", label: "Quitar duplicados", icon: <DedupeIcon /> },
  { mode: "stats", label: "Estadísticas", icon: <StatsIcon /> },
  { mode: "chart", label: "Gráfico", icon: <ChartIcon /> },
];

interface RibbonProps {
  mode: WorkspaceMode | null; // null = ninguna herramienta abierta
  onChange: (mode: WorkspaceMode) => void;
}

/** Barra de herramientas: cada botón abre/cierra su panel lateral sobre la tabla. */
export function Ribbon({ mode, onChange }: RibbonProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {COMMANDS.map((command) => {
        const active = mode === command.mode;
        return (
          <button
            key={command.mode}
            type="button"
            onClick={() => onChange(command.mode)}
            className={
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors " +
              (active
                ? "border-emerald-200 bg-white font-medium text-emerald-800 shadow-sm"
                : "border-transparent text-slate-600 hover:bg-white/70")
            }
          >
            <span aria-hidden="true" className={active ? "text-emerald-600" : "text-slate-400"}>
              {command.icon}
            </span>
            {command.label}
          </button>
        );
      })}
    </div>
  );
}
