export type DataErrorCode =
  | "Unauthenticated"
  | "DatabaseUnavailable"
  | "MigrationMissing"
  | "ConstraintViolation"
  | "NotFound"
  | "Forbidden"
  | "Conflict"
  | "InvalidInput"
  | "Disabled";
export class DataError extends Error {
  constructor(
    public readonly code: DataErrorCode,
    public readonly status = 400,
  ) {
    super(code);
  }
}
export function safeDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    const e = current as { code?: unknown; cause?: unknown };
    if (e.code === "42P01" || e.code === "42703")
      return new DataError("MigrationMissing", 503);
    if (
      e.code === "23505" ||
      e.code === "23503" ||
      e.code === "23514" ||
      e.code === "23502"
    )
      return new DataError("ConstraintViolation", 409);
    if (e.code === "40001" || e.code === "40P01")
      return new DataError("Conflict", 409);
    current = e.cause;
  }
  return new DataError("DatabaseUnavailable", 503);
}
