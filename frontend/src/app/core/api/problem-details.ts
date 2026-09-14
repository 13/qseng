// Canonical client-side ProblemDetails types for error handling. The generated client also exports ProblemDetails/ValidationProblemDetails under core/api/generated; import from here in application code.
import { HttpErrorResponse } from '@angular/common/http';

export interface ProblemDetails { type?: string; title?: string; status?: number; detail?: string; }
export interface ValidationProblemDetails extends ProblemDetails { errors: Record<string, string[]>; }

export function isProblem(x: unknown): x is ProblemDetails {
  return typeof x === 'object' && x !== null && ('title' in x || 'status' in x || 'detail' in x);
}

export function isValidationProblem(x: unknown): x is ValidationProblemDetails {
  return isProblem(x) && typeof (x as ValidationProblemDetails).errors === 'object' && (x as ValidationProblemDetails).errors !== null;
}

/** Best human-readable message from an HTTP error, else the fallback. */
export function problemMessage(err: unknown, fallback: string): string {
  const body = err instanceof HttpErrorResponse ? err.error : err;
  if (isValidationProblem(body)) {
    const first = Object.values(body.errors).flat()[0];
    if (first) return first;
  }
  if (isProblem(body)) return body.detail ?? fallback;
  return fallback;
}
