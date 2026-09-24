import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

interface SaveAsDialogProps {
  open: boolean;
  title?: string;
  label?: string;
  defaultName: string;
  confirmLabel?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/**
 * Diálogo modal para nombrar un archivo (reemplaza a window.prompt para mantener el
 * estilo de la app). Se renderiza vía portal en <body> para no verse afectado por
 * contenedores ocultos o con overflow.
 */
export function SaveAsDialog({
  open,
  title = "Guardar como archivo",
  label = "Nombre del archivo",
  defaultName,
  confirmLabel = "Guardar",
  onConfirm,
  onCancel,
}: SaveAsDialogProps) {
  const [name, setName] = useState(defaultName);

  // Reinicia el nombre al valor sugerido cada vez que se abre.
  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  if (!open) return null;

  const trimmed = name.trim();
  const confirm = () => {
    if (trimmed) onConfirm(trimmed);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <label className="mt-3 block text-xs font-medium text-slate-500">{label}</label>
        <Input
          autoFocus
          className="mt-1 w-full"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") confirm();
            if (event.key === "Escape") onCancel();
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={confirm} disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
