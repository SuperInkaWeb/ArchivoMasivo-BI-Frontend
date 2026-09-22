/** Contratos compartidos con el backend (deben reflejar los schemas de FastAPI). */

export type IngestStatus = "pending" | "processing" | "ready" | "failed";
/** Cómo se creó el dataset: subido por el usuario o generado por un pivote. */
export type DatasetOrigin = "uploaded" | "pivot";

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface DatasetSummary {
  id: string;
  original_filename: string;
  status: IngestStatus;
  origin: DatasetOrigin;
  row_count: number | null;
  size_bytes: number;
  created_at: string;
  error: string | null;
}

export interface DatasetDetail extends DatasetSummary {
  columns: ColumnInfo[];
  sheets: string[];
  active_sheet: string | null;
}

export interface DistinctValues {
  column: string;
  values: string[];
  truncated: boolean;
}

export interface UploadTicket {
  dataset: DatasetSummary;
  upload_url: string;
  direct_to_storage: boolean;
}

export type Operator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null"
  | "between";

export type Combinator = "and" | "or";
export type SortDirection = "asc" | "desc";
export type DownloadFormat = "csv" | "xlsx" | "txt";
/** Separador para la descarga en TXT (solo aplica a ese formato). */
export type Delimiter = "tab" | "pipe" | "semicolon" | "comma";

export type FilterValue = string | number | boolean | Array<string | number> | null;

/** Hoja del árbol: una condición sobre una columna. */
export interface FilterLeaf {
  type: "condition";
  column: string;
  operator: Operator;
  value?: FilterValue;
}

/** Grupo del árbol: un conector (AND/OR) con hijos (hojas u otros grupos). */
export interface FilterGroup {
  type: "group";
  combinator: Combinator;
  children: FilterNode[];
}

export type FilterNode = FilterLeaf | FilterGroup;

export interface SortSpec {
  column: string;
  direction: SortDirection;
}

export interface FilterRequest {
  filter: FilterGroup | null; // árbol raíz; null = sin filtro
  select: string[];
  sort: SortSpec[];
}

export interface PreviewRequest extends FilterRequest {
  limit: number;
  offset: number;
}

export interface PreviewResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_matched: number;
  limit: number;
  offset: number;
}

export interface DownloadRequest extends FilterRequest {
  format: DownloadFormat;
  delimiter?: Delimiter; // solo se envía cuando format === "txt"
}

// --- Tablas dinámicas (pivote) ---
export type Aggregation = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

/** Una métrica del reporte: agregación sobre una columna (column ausente = conteo de filas). */
export interface Measure {
  column?: string | null;
  aggregation: Aggregation;
}

export interface PivotRequest {
  filter: FilterGroup | null;
  group_by: string[];
  measures: Measure[];
  pivot_column?: string | null; // cross-tab opcional
  limit: number;
  offset: number;
}

export interface PivotResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_matched: number;
  limit: number;
  offset: number;
}

export interface PivotSaveRequest extends PivotRequest {
  name: string;
}
