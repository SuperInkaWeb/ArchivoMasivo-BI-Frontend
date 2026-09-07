import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

const ACCEPTED = ".csv,.txt,.xlsx,.xls";

interface UploadDropzoneProps {
  onUpload: (files: File[]) => void;
  busy: boolean;
}

export function UploadDropzone({ onUpload, busy }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function emit(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onUpload(Array.from(fileList));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    emit(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        dragging ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white",
      )}
    >
      <p className="text-sm text-slate-600">
        Arrastra archivos aquí o{" "}
        <button
          type="button"
          className="font-medium text-slate-900 underline underline-offset-2"
          onClick={() => inputRef.current?.click()}
        >
          selecciónalos
        </button>
      </p>
      <p className="text-xs text-slate-400">CSV, TXT o Excel — se aceptan varios a la vez</p>
      {busy ? (
        <span className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
          <Spinner /> Subiendo…
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        Elegir archivos
      </Button>
    </div>
  );
}
