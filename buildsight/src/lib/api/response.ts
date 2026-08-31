import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data as object, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

/** Map thrown errors onto stable API error shapes without leaking internals. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return apiError(error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", error.message, error.status);
  }
  if (error instanceof ZodError) {
    return apiError("VALIDATION_FAILED", "Request validation failed.", 422, error.flatten());
  }
  if (error instanceof Error && error.name === "NotFoundError") {
    return apiError("NOT_FOUND", error.message, 404);
  }
  console.error("[api] unhandled error", error);
  return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}
