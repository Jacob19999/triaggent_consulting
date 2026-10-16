"use client";

import { useEffect, useState } from "react";
import { fetchNetworkPayload, siteTypesFrom, type SiteTypeMix } from "@/lib/networks";

/** Reporting sites per county by Organization.AgencyType (research snapshot, county counts). */
export function useSiteTypes(): { mix: SiteTypeMix | null; error: string | null } {
  const [mix, setMix] = useState<SiteTypeMix | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchNetworkPayload()
      .then((p) => live && setMix(siteTypesFrom(p)))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);
  return { mix, error };
}
