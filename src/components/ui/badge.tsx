import { cn } from "@/lib/utils";
import type { IngestStatus } from "@/types";

const STATUS_META: Record<IngestStatus, { label: string; className: string }> = {
  pending: { label: "En cola", className: "bg-amber-50 text-amber-700 border-amber-200" },
  processing: { label: "Procesando", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ready: { label: "Listo", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Error", className: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({ status }: { status: IngestStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
