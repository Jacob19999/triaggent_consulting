"use client";

import { useEffect, useState } from "react";
import { loadDriveReach, type DriveReach, type DriveStatus, type LonLat } from "@/lib/drive";
import type { FeiTract } from "@/lib/types";

/** Driving access for the current site, loaded in the background. A newer site cancels the
 * request in flight; a short debounce keeps rapid map clicks from queueing routes. */
export function useDriveReach(site: LonLat | null, tracts: FeiTract[] | null): { status: DriveStatus; reach: DriveReach | null } {
  const [state, setState] = useState<{ status: DriveStatus; reach: DriveReach | null }>({ status: "idle", reach: null });
  const lon = site?.lon;
  const lat = site?.lat;
  useEffect(() => {
    if (lon == null || lat == null || !tracts) {
      setState({ status: "idle", reach: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", reach: null });
    const timer = setTimeout(() => {
      loadDriveReach({ lon, lat }, tracts, controller.signal)
        .then((reach) => setState(reach ? { status: "ready", reach } : { status: "unavailable", reach: null }))
        .catch(() => undefined); // aborted by a newer site
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lon, lat, tracts]);
  return state;
}

/** Driving access for several sites (ranked search options), keyed by index, filled as each
 * one resolves. */
export function useDriveReachMany(sites: LonLat[], tracts: FeiTract[] | null): (DriveReach | null | undefined)[] {
  const [out, setOut] = useState<(DriveReach | null | undefined)[]>([]);
  const key = sites.map((s) => `${s.lon.toFixed(5)},${s.lat.toFixed(5)}`).join(";");
  useEffect(() => {
    setOut(sites.map(() => undefined));
    if (!tracts || !sites.length) return;
    const controller = new AbortController();
    sites.forEach((s, i) =>
      loadDriveReach(s, tracts, controller.signal)
        .then((reach) =>
          setOut((prev) => {
            const next = [...prev];
            next[i] = reach;
            return next;
          }),
        )
        .catch(() => undefined),
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tracts]);
  return out;
}
