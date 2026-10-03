import "server-only";
import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  data: T;
  error: null;
};

export type ApiFailure = {
  data: null;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data, error: null }, init);
}

export function apiFailure(error: string, status: number, init?: ResponseInit) {
  return NextResponse.json<ApiFailure>(
    { data: null, error },
    { ...init, status }
  );
}

/**
 * A client-facing failure raised from inside a query or parser (bad params,
 * missing resource). Route handlers turn it into `apiFailure(message, status)`;
 * anything else that is thrown stays an opaque 500.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
