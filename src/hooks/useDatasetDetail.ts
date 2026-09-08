import { useCallback, useEffect, useState } from "react";
import { getDataset } from "@/services/datasets";
import { errorMessage } from "@/lib/utils";
import type { DatasetDetail } from "@/types";

const POLL_INTERVAL_MS = 1500;

/** Carga el detalle (esquema + hojas) del dataset y lo refresca mientras se procesa.
 *
 * Devuelve `reload` para forzar una recarga (p. ej. tras cambiar de hoja de Excel).
 */
export function useDatasetDetail(datasetId: string | null) {
  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!datasetId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await getDataset(datasetId));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [datasetId]);

  useEffect(() => {
    if (!datasetId) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [datasetId, load]);

  // Refresca mientras la (re)ingesta esté en curso, hasta que quede lista.
  const status = detail?.status;
  useEffect(() => {
    if (status !== "processing" && status !== "pending") return;
    const timerId = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [status, load]);

  return { detail, loading, error, reload: load };
}
