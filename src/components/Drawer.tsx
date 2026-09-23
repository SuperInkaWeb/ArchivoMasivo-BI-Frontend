import type { ReactNode } from "react";

interface DrawerProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Panel lateral que se abre sobre la tabla (la tabla sigue al centro, siempre visible). */
export function Drawer({ title, description, onClose, children }: DrawerProps) {
  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-[480px] max-w-[92vw] flex-col rounded-l-xl border-l border-slate-300 bg-white shadow-2xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
