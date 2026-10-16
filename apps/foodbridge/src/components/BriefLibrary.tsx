"use client";

import { useCallback, useEffect, useState } from "react";
import { BRIEF_SAVED_EVENT, type BriefDetail, type BriefSummary } from "@/lib/briefs";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { useData } from "./DataProvider";
import { Markdown } from "./Markdown";
import { Badge, Button, Card, Icon } from "./ui";

const MODE_LABEL: Record<BriefSummary["mode"], string> = {
  briefing: "Weekly",
  county: "County",
  shelf: "Shelf",
  ask: "Question",
};

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function BriefLibrary() {
  const { session, ready } = useData();
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [open, setOpen] = useState<BriefDetail | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) {
      setStatus("loading");
      return;
    }
    if (!session.signedIn) {
      setStatus("signed-out");
      setBriefs([]);
      setOpen(null);
      return;
    }
    setMessage(null);
    try {
      const res = await fetch("/api/briefs");
      const body = (await res.json()) as { briefs?: BriefSummary[]; error?: string };
      if (res.status === 401) {
        setStatus("signed-out");
        setBriefs([]);
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Saved briefings are unavailable.");
        return;
      }
      setBriefs(body.briefs ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Saved briefings are unavailable.");
    }
  }, [ready, session.signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSaved = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id ?? null;
      setFreshId(id);
      void load();
    };
    window.addEventListener(BRIEF_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(BRIEF_SAVED_EVENT, onSaved);
  }, [load]);

  const openBrief = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/briefs/${id}`);
      const body = (await res.json()) as { brief?: BriefDetail; error?: string };
      if (!res.ok || !body.brief) {
        setMessage(body.error ?? "That briefing is unavailable.");
        return;
      }
      setOpen(body.brief);
    } catch {
      setMessage("That briefing is unavailable.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this briefing for every account?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/briefs/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(body.error ?? "This briefing could not be removed.");
        return;
      }
      if (open?.id === id) setOpen(null);
      if (freshId === id) setFreshId(null);
      await load();
    } catch {
      setMessage("This briefing could not be removed.");
    } finally {
      setBusyId(null);
    }
  };

  const canDelete = session.signedIn && session.liveRole === "manager";

  return (
    <Card
      className="mt-4"
      icon="history"
      title="Previously generated"
      subtitle="A briefing saved by any account appears here for every account."
    >
      {status === "loading" && <p className="text-[13px] text-muted">Loading saved briefings…</p>}
      {status === "signed-out" && (
        <p className="text-[13px] text-muted">Sign in to see briefings saved by the team.</p>
      )}
      {status === "error" && <p className="text-[13px] text-[var(--critical-text)]">{message}</p>}
      {status === "ready" && briefs.length === 0 && (
        <p className="text-[13px] text-muted">None yet. Generate a briefing and it is kept for every account.</p>
      )}
      {status === "ready" && briefs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {briefs.map((brief) => {
              const selected = open?.id === brief.id;
              return (
                <li key={brief.id}>
                  <button
                    type="button"
                    onClick={() => void openBrief(brief.id)}
                    disabled={busyId === brief.id}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-surface-2 ${selected ? "bg-surface-2" : ""}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[13px] font-medium text-ink">{brief.title}</span>
                      {brief.id === freshId && <Badge tone="green">New</Badge>}
                    </span>
                    <span className="text-[12px] text-muted">
                      {MODE_LABEL[brief.mode] ?? brief.mode} · {monthLabel(brief.as_of, "short")} · {when(brief.created_at)}
                    </span>
                    <span className="truncate text-[12px] text-muted">{brief.author_email ?? "Account"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0">
            {!open && <p className="text-[13px] text-muted">Select a briefing to read it.</p>}
            {open && (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={open.result_mode === "ai" ? "green" : "neutral"}>{open.result_mode === "ai" ? (open.model ?? "AI") : "Offline"}</Badge>
                  <span className="text-[12.5px] text-muted">
                    {open.author_email ?? "Account"} · {fmt.date(open.created_at)}
                  </span>
                  {canDelete && (
                    <Button variant="danger" size="sm" className="ml-auto" disabled={busyId === open.id} onClick={() => void remove(open.id)}>
                      <Icon name="trash" className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                {open.note && <p className="mb-2 text-[12.5px] text-muted">{open.note}</p>}
                <Markdown source={open.markdown} />
              </div>
            )}
          </div>
        </div>
      )}
      {status === "ready" && message && <p className="mt-3 text-[13px] text-[var(--critical-text)]">{message}</p>}
    </Card>
  );
}
