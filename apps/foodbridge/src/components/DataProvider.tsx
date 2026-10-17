"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computeAlerts, type Alert, type ShelfOutlook } from "@/lib/alerts";
import { lastFullMonth } from "@/lib/calendar";
import { liveAvailable } from "@/lib/config";
import { prefetchMapPayloads } from "@/lib/feiTracts";
import { NETWORK_AS_OF } from "@/lib/networks";
import { fetchSitePoints } from "@/lib/sitePoints";
import { DemoStore, SupabaseStore, type Snapshot, type Store } from "@/lib/store";
import { browserSupabase } from "@/lib/supabase/client";
import type { AlertState, Role } from "@/lib/types";

type Mode = "demo" | "live";

interface Session {
  mode: Mode;
  role: Role;
  shelfId: string | null; // shelf the portal shows
  email: string | null;
  signedIn: boolean;
  liveRole: "pending" | Role | null; // role from profiles when live
}

interface DataContextValue {
  ready: boolean;
  error: string | null;
  session: Session;
  store: Store;
  data: Snapshot;
  asOf: string;
  alerts: Alert[];
  outlooks: ShelfOutlook[];
  alertState: (key: string) => AlertState | undefined;
  refresh: () => Promise<void>;
  setRole: (role: Role) => void;
  setShelf: (id: string) => void;
  setMode: (mode: Mode) => void;
  signOut: () => Promise<void>;
}

const EMPTY: Snapshot = { shelves: [], reports: [], requests: [], alertStates: [], scenarios: [] };
const Ctx = createContext<DataContextValue | null>(null);

const PREFS = "foodbridge.prefs.v1";
function readPrefs(): Partial<Pick<Session, "mode" | "role" | "shelfId">> {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS) ?? "{}");
  } catch {
    return {};
  }
}
function writePrefs(p: Partial<Session>) {
  try {
    const { mode, role, shelfId } = p;
    window.localStorage.setItem(PREFS, JSON.stringify({ mode, role, shelfId }));
  } catch {
    // Not persisted; the session still works.
  }
}

const demoStore = new DemoStore();
const liveStore = new SupabaseStore();

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    mode: "demo",
    role: "manager",
    shelfId: null,
    email: null,
    signedIn: false,
    liveRole: null,
  });
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store: Store = session.mode === "live" ? liveStore : demoStore;
  const asOf = session.mode === "live" ? lastFullMonth() : NETWORK_AS_OF;

  const load = useCallback(async (s: Store) => {
    try {
      setError(null);
      setData(await s.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(EMPTY);
    } finally {
      setReady(true);
    }
  }, []);

  // Resolve the mode and, when live, the signed-in user's profile.
  useEffect(() => {
    const prefs = readPrefs();
    const supabase = browserSupabase();
    const init = async () => {
      // Any valid session opens the live workspace (the magic link may open in another
      // browser), unless this browser explicitly chose the demo workspace.
      if (liveAvailable && supabase && prefs.mode !== "demo") {
        try {
          const { data: local } = await supabase.auth.getSession();
          const { data: auth } = local.session ? await supabase.auth.getUser() : { data: { user: null } };
          if (auth.user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role, shelf_id, email")
              .eq("id", auth.user.id)
              .maybeSingle();
            const liveRole = (profile?.role ?? "pending") as Session["liveRole"];
            const next: Session = {
              mode: "live",
              role: liveRole === "shelf" ? "shelf" : "manager",
              shelfId: profile?.shelf_id ?? null,
              email: auth.user.email ?? null,
              signedIn: true,
              liveRole,
            };
            setSession(next);
            writePrefs(next);
            await load(liveStore);
            return;
          }
        } catch {
          // Supabase unreachable: fall through to the county networks workspace.
        }
      }
      const next: Session = {
        mode: "demo",
        role: prefs.role ?? "manager",
        shelfId: prefs.shelfId ?? null,
        email: null,
        signedIn: false,
        liveRole: null,
      };
      setSession(next);
      await load(demoStore);
    };
    void init();
  }, [load]);

  // Tract outlines and shelf points are lazy ~1 MB JSON. Start them on the first page so
  // /present and the command-center maps are not an empty "Loading census tracts…" box.
  useEffect(() => {
    prefetchMapPayloads();
    void fetchSitePoints().catch(() => {});
  }, []);

  // Default the portal to the first shelf the user can see.
  useEffect(() => {
    if (!session.shelfId && data.shelves.length) {
      setSession((s) => ({ ...s, shelfId: data.shelves[0].id }));
    }
  }, [data.shelves, session.shelfId]);

  const { alerts, outlooks } = useMemo(
    () => computeAlerts({ shelves: data.shelves, reports: data.reports, asOf }),
    [data.shelves, data.reports, asOf],
  );

  const states = useMemo(() => new Map(data.alertStates.map((a) => [a.alert_key, a])), [data.alertStates]);

  const value: DataContextValue = {
    ready,
    error,
    session,
    store,
    data,
    asOf,
    alerts,
    outlooks,
    alertState: (key) => states.get(key),
    refresh: () => load(store),
    setRole: (role) => {
      if (session.mode === "live") return; // live roles come from the profile
      const next = { ...session, role };
      setSession(next);
      writePrefs(next);
    },
    setShelf: (id) => {
      if (session.mode === "live" && session.liveRole === "shelf") return;
      const next = { ...session, shelfId: id };
      setSession(next);
      writePrefs(next);
    },
    setMode: (mode) => {
      writePrefs({ ...session, mode });
      window.location.href = mode === "live" ? "/login" : "/";
    },
    signOut: async () => {
      await browserSupabase()?.auth.signOut();
      writePrefs({ ...session, mode: "demo" });
      window.location.href = "/";
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}
