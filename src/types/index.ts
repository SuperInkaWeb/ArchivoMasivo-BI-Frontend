/** Contratos compartidos con el backend (deben reflejar los schemas de FastAPI). */

export type IngestStatus = "pending" | "processing" | "ready" | "failed";

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface DatasetSummary {
  id: string;
  original_filename: string;
  status: IngestStatus;
  row_count: number | null;
  size_bytes: number;
  created_at: string;
  error: string | null;
}

export interface DatasetDetail extends DatasetSummary {
  columns: ColumnInfo[];
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
export type DownloadFormat = "csv" | "xlsx";

export type FilterValue = string | number | boolean | Array<string | number> | null;

export interface FilterCondition {
  column: string;
  operator: Operator;
  value?: FilterValue;
}

export interface SortSpec {
  column: string;
  direction: SortDirection;
}

export interface FilterRequest {
  conditions: FilterCondition[];
  combinator: Combinator;
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
}
