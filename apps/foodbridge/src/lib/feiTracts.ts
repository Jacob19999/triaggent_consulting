"use client";
import { useEffect, useState } from "react";
import { feiReady } from "./research";
import type { FeiTractPayload } from "./types";

let cache: Promise<FeiTractPayload> | null = null;

/** Tract FEI rows and outlines (≈1 MB) load only on pages that need them. */
export function loadFeiTracts(): Promise<FeiTractPayload> {
  cache ??= fetch("/data/fei-tracts.json")
    .then((r) => {
      if (!r.ok) throw new Error(`fei-tracts.json: HTTP ${r.status}`);
      return r.json() as Promise<FeiTractPayload>;
    })
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

/** Start the 1 MB tract download as soon as the app opens so /present maps are not blank. */
export function prefetchMapPayloads(): void {
  if (feiReady) void loadFeiTracts().catch(() => {});
}

export function useFeiTracts(): { data: FeiTractPayload | null; error: string | null } {
  const [data, setData] = useState<FeiTractPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!feiReady) return;
    loadFeiTracts()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  return { data, error };
}
