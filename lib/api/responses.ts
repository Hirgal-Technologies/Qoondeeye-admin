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

export function apiFailure(error: string, status: number) {
  return NextResponse.json<ApiFailure>(
    { data: null, error },
    { status }
  );
}
