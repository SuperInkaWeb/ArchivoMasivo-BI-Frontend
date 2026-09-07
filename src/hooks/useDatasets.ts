import { useCallback, useEffect, useState } from "react";
import { listDatasets } from "@/services/datasets";
import { errorMessage } from "@/lib/utils";
import type { DatasetSummary } from "@/types";

const POLL_INTERVAL_MS = 1500;

/** Lista los datasets y hace polling automático mientras haya ingestas en curso. */
export function useDatasets() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDatasets(await listDatasets());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasInProgress = datasets.some(
    (dataset) => dataset.status === "pending" || dataset.status === "processing",
  );

  useEffect(() => {
    if (!hasInProgress) return;
    const timerId = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [hasInProgress, refresh]);

  return { datasets, loading, error, refresh };
}
