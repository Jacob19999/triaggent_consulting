"use client";

import { useEffect, useState } from "react";
import { fetchSitePoints, type SitePoints } from "@/lib/sitePoints";

/** Reporting sites at researched coordinates (D-063); loads once per page. */
export function useSitePoints(): { sites: SitePoints | null; error: string | null } {
  const [sites, setSites] = useState<SitePoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchSitePoints()
      .then((s) => live && setSites(s))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);
  return { sites, error };
}
