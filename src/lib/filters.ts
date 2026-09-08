/** Metadatos y utilidades de filtros del lado cliente (árbol recursivo).
 *
 * Traduce el árbol de borradores de la UI al contrato del backend, coaccionando
 * valores numéricos cuando la columna lo es. La validación real (whitelist,
 * binding, límites) ocurre en el backend; aquí solo mejoramos la experiencia.
 */
import type {
  ColumnInfo,
  Combinator,
  FilterGroup,
  FilterLeaf,
  FilterNode,
  FilterValue,
  Operator,
} from "@/types";

export interface OperatorOption {
  value: Operator;
  label: string;
}

export const OPERATOR_OPTIONS: OperatorOption[] = [
  { value: "eq", label: "= igual a" },
  { value: "ne", label: "≠ distinto de" },
  { value: "gt", label: "> mayor que" },
  { value: "gte", label: "≥ mayor o igual" },
  { value: "lt", label: "< menor que" },
  { value: "lte", label: "≤ menor o igual" },
  { value: "contains", label: "contiene" },
  { value: "not_contains", label: "no contiene" },
  { value: "starts_with", label: "empieza con" },
  { value: "ends_with", label: "termina con" },
  { value: "in", label: "está en (lista)" },
  { value: "not_in", label: "no está en (lista)" },
  { value: "between", label: "entre (rango)" },
  { value: "is_null", label: "es vacío" },
  { value: "is_not_null", label: "no es vacío" },
];

export type ValueKind = "none" | "single" | "list" | "range";

export function operatorValueKind(operator: Operator): ValueKind {
  if (operator === "is_null" || operator === "is_not_null") return "none";
  if (operator === "in" || operator === "not_in") return "list";
  if (operator === "between") return "range";
  return "single";
}

const NUMERIC_TYPE = /(INT|DOUBLE|FLOAT|DECIMAL|REAL|NUMERIC|HUGEINT)/i;
const STRING_ONLY_OPS = new Set<Operator>(["contains", "not_contains", "starts_with", "ends_with"]);

export function isNumericType(columnType: string): boolean {
  return NUMERIC_TYPE.test(columnType);
}

function coerceScalar(raw: string, columnType: string, operator: Operator): string | number {
  const trimmed = raw.trim();
  if (!STRING_ONLY_OPS.has(operator) && isNumericType(columnType)) {
    const asNumber = Number(trimmed);
    if (trimmed !== "" && !Number.isNaN(asNumber)) return asNumber;
  }
  return trimmed;
}

function buildScalarValue(raw: string, columnType: string, operator: Operator): FilterValue {
  const kind = operatorValueKind(operator);
  if (kind === "range") {
    const [from = "", to = ""] = raw.split(",");
    return [coerceScalar(from, columnType, operator), coerceScalar(to, columnType, operator)];
  }
  return coerceScalar(raw, columnType, operator);
}

function coerceListValues(values: string[], columnType: string, operator: Operator): Array<string | number> {
  return values.map((value) => coerceScalar(value, columnType, operator));
}

// ---------------------------------------------------------------------------
// Borradores del árbol de filtros (estado de la UI)
// ---------------------------------------------------------------------------

/** Hoja en la UI: mantiene el valor como texto crudo (`raw`) o casillas (`values`). */
export interface LeafDraft {
  id: string;
  type: "condition";
  column: string;
  operator: Operator;
  raw: string;
  values: string[];
}

/** Grupo en la UI: conector + hijos (hojas u otros grupos). */
export interface GroupDraft {
  id: string;
  type: "group";
  combinator: Combinator;
  children: NodeDraft[];
}

export type NodeDraft = LeafDraft | GroupDraft;

export function createLeaf(defaultColumn: string): LeafDraft {
  return { id: crypto.randomUUID(), type: "condition", column: defaultColumn, operator: "eq", raw: "", values: [] };
}

export function createGroup(): GroupDraft {
  return { id: crypto.randomUUID(), type: "group", combinator: "and", children: [] };
}

function leafToNode(leaf: LeafDraft, columns: ColumnInfo[]): FilterLeaf {
  const columnType = columns.find((column) => column.name === leaf.column)?.type ?? "VARCHAR";
  const kind = operatorValueKind(leaf.operator);
  const node: FilterLeaf = { type: "condition", column: leaf.column, operator: leaf.operator };
  if (kind === "none") return node;
  node.value = kind === "list"
    ? coerceListValues(leaf.values, columnType, leaf.operator)
    : buildScalarValue(leaf.raw, columnType, leaf.operator);
  return node;
}

/** Convierte un nodo borrador (hoja o grupo) al contrato del backend. */
export function nodeToFilter(node: NodeDraft, columns: ColumnInfo[]): FilterNode {
  if (node.type === "condition") return leafToNode(node, columns);
  return {
    type: "group",
    combinator: node.combinator,
    children: node.children.map((child) => nodeToFilter(child, columns)),
  };
}

/** Árbol raíz -> filtro para la petición. Devuelve null si no hay condiciones. */
export function rootToFilter(root: GroupDraft, columns: ColumnInfo[]): FilterGroup | null {
  if (root.children.length === 0) return null;
  return nodeToFilter(root, columns) as FilterGroup;
}
