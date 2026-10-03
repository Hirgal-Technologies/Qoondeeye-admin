"use client";

import { useEffect, useState } from "react";

/** Advances once a second so “updated N seconds ago” stays current. */
export function useTickingNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
