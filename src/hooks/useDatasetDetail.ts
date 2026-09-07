import { useEffect, useState } from "react";
import { getDataset } from "@/services/datasets";
import { errorMessage } from "@/lib/utils";
import type { DatasetDetail } from "@/types";

/** Carga el detalle (con esquema de columnas) del dataset seleccionado. */
export function useDatasetDetail(datasetId: string | null) {
  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      setDetail(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    getDataset(datasetId)
      .then((result) => {
        if (active) {
          setDetail(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [datasetId]);

  return { detail, loading, error };
}
