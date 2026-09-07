/** Metadatos y utilidades de filtros del lado cliente.
 *
 * Traduce lo que el usuario escribe al contrato del backend, coaccionando
 * valores numéricos cuando la columna lo es. La validación real (whitelist,
 * binding) ocurre en el backend; aquí solo mejoramos la experiencia.
 */
import type { ColumnInfo, FilterCondition, FilterValue, Operator } from "@/types";

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

/** Construye el `value` que espera el backend a partir del texto del usuario. */
export function buildFilterValue(raw: string, columnType: string, operator: Operator): FilterValue {
  const kind = operatorValueKind(operator);
  if (kind === "none") return null;
  if (kind === "list") {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => coerceScalar(part, columnType, operator));
  }
  if (kind === "range") {
    const [from = "", to = ""] = raw.split(",");
    return [coerceScalar(from, columnType, operator), coerceScalar(to, columnType, operator)];
  }
  return coerceScalar(raw, columnType, operator);
}

/** Borrador de condición en la UI (el valor se mantiene como texto crudo). */
export interface ConditionDraft {
  id: string;
  column: string;
  operator: Operator;
  raw: string;
}

export function createDraft(defaultColumn: string): ConditionDraft {
  return { id: crypto.randomUUID(), column: defaultColumn, operator: "eq", raw: "" };
}

/** Convierte un borrador a la condición que consume el backend. */
export function toFilterCondition(draft: ConditionDraft, columns: ColumnInfo[]): FilterCondition {
  const columnType = columns.find((column) => column.name === draft.column)?.type ?? "VARCHAR";
  const condition: FilterCondition = { column: draft.column, operator: draft.operator };
  if (operatorValueKind(draft.operator) !== "none") {
    condition.value = buildFilterValue(draft.raw, columnType, draft.operator);
  }
  return condition;
}
