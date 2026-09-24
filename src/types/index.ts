/** Contratos compartidos con el backend (deben reflejar los schemas de FastAPI). */

export type IngestStatus = "pending" | "processing" | "ready" | "failed";
/** Cómo se creó el dataset: subido, o derivado (pivote / columnas / correcciones). */
export type DatasetOrigin = "uploaded" | "pivot" | "computed" | "replaced";

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
  search?: string; // búsqueda global: aparece en cualquier columna (insensible)
}

export interface PreviewResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_matched: number;
  limit: number;
  offset: number;
  // Fila de Total general (solo la produce el pivote); ausente en las demás vistas.
  totals?: Record<string, unknown> | null;
}

/** Acciones que una herramienta registra al generar un resultado (para exportarlo desde el centro). */
export interface ToolPreviewOptions {
  countLabel?: string;
  download: (format: DownloadFormat, delimiter?: Delimiter) => void | Promise<void>;
  save: () => void | Promise<void>;
}

export interface DownloadRequest extends FilterRequest {
  format: DownloadFormat;
  delimiter?: Delimiter; // solo se envía cuando format === "txt"
  search?: string; // misma búsqueda global que la vista previa
}

// --- Tablas dinámicas (pivote) ---
export type Aggregation = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

/** Una métrica del reporte: agregación sobre una columna (column ausente = conteo de filas). */
export interface Measure {
  column?: string | null;
  aggregation: Aggregation;
}

/** Orden del reporte: por una columna de agrupación o por una métrica (índice). */
export interface PivotSort {
  column?: string | null;
  measure_index?: number | null;
  direction: SortDirection;
}

export interface PivotRequest {
  filter: FilterGroup | null;
  group_by: string[];
  measures: Measure[];
  pivot_column?: string | null; // cross-tab opcional
  sort?: PivotSort | null; // orden del reporte; ausente = por columnas de agrupación
  percent_of_total?: boolean; // mostrar cada valor como % del total (solo Suma/Conteo)
  limit: number;
  offset: number;
}

export interface PivotResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_matched: number;
  limit: number;
  offset: number;
  // Fila de Total general (métricas sobre todas las filas), sin columnas de agrupación.
  totals?: Record<string, unknown> | null;
}

export interface PivotSaveRequest extends PivotRequest {
  name: string;
}

/** Descarga directa del reporte pivote completo (sin paginación). */
export interface PivotDownloadRequest {
  filter: FilterGroup | null;
  group_by: string[];
  measures: Measure[];
  pivot_column?: string | null;
  sort?: PivotSort | null;
  percent_of_total?: boolean;
  format: DownloadFormat;
  delimiter?: Delimiter; // solo se envía cuando format === "txt"
}

// --- Columnas calculadas (árbol de expresiones) ---
export type FunctionName =
  | "concat"
  | "upper"
  | "lower"
  | "trim"
  | "length"
  | "substr"
  | "replace"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "round"
  | "if"
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "and"
  | "or"
  | "not"
  | "year"
  | "month"
  | "day"
  | "datediff_days";

export type Expression =
  | { kind: "column"; name: string }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "function"; fn: FunctionName; args: Expression[] };

export interface ComputedColumn {
  name: string;
  expression: Expression;
}

export interface ComputeRequest {
  filter: FilterGroup | null;
  columns: ComputedColumn[];
  limit: number;
  offset: number;
}

export interface ComputeSaveRequest extends ComputeRequest {
  name: string;
}

/** Descarga directa de todas las filas con las columnas calculadas. */
export interface ComputeDownloadRequest {
  filter: FilterGroup | null;
  columns: ComputedColumn[];
  format: DownloadFormat;
  delimiter?: Delimiter; // solo se envía cuando format === "txt"
}

// --- Buscar y reemplazar por columna ---
export type MatchMode = "exact" | "contains";

/** Una corrección: en `column`, cambiar `search` por `replace`. */
export interface ReplacementRule {
  column: string;
  mode: MatchMode;
  search: string;
  replace: string;
  case_sensitive?: boolean; // solo aplica al modo "exact"
}

export interface ReplaceRequest {
  filter: FilterGroup | null;
  replacements: ReplacementRule[];
  limit: number;
  offset: number;
}

export interface ReplaceSaveRequest {
  filter: FilterGroup | null;
  replacements: ReplacementRule[];
  name: string;
}

export interface ReplaceDownloadRequest {
  filter: FilterGroup | null;
  replacements: ReplacementRule[];
  format: DownloadFormat;
  delimiter?: Delimiter; // solo se envía cuando format === "txt"
}
