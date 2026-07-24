"use client";

import { useCallback, useEffect, useState } from "react";

type ApiState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

type ApiResult<T> = ApiState<T> & { retry: () => void };

function safeErrorMessage(value: unknown) {
  if (value === "unauthorized") return "Your session has expired. Sign in again.";
  if (value === "forbidden") return "You do not have permission to view this data.";
  return "We couldn’t load this data. Try again.";
}

/** Fetches a `{ data, error }` endpoint and exposes a retryable, safe UI state. */
export function useApiData<T>(url: string): ApiResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ApiState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState({ status: "loading", data: null, error: null });
      }
    });

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const body = await response
          .json()
          .catch(() => ({ data: null, error: "invalid response" }));
        if (controller.signal.aborted) return;
        if (!response.ok || body.error) {
          setState({
            status: "error",
            data: null,
            error: safeErrorMessage(body.error),
          });
          return;
        }
        setState({ status: "success", data: body.data as T, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error: safeErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [attempt, url]);

  return { ...state, retry };
}
