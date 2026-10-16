"use client";

import { useEffect, useState } from "react";
import { AgentPanel } from "@/components/AgentPanel";
import { BriefLibrary } from "@/components/BriefLibrary";
import { CountyAlertSelect } from "@/components/CountyAlertSelect";
import { Card, Field, Input, PageHeader, Select, SourceNote } from "@/components/ui";
import { research } from "@/lib/research";

const EXAMPLES = [
  "Which SNAP changes in the last six months should shelves in rural counties prepare for?",
  "Where would a new mobile pantry stop reduce barriers most, according to FEI?",
  "Summarize what our Q6 audit-first counties have in common.",
  "Which shelves may run short of food next month, and what should I ask the food bank for?",
];

export default function BriefingPage() {
  const [mode, setMode] = useState<"briefing" | "county" | "ask">("briefing");
  const [county, setCounty] = useState("Chippewa");
  const [question, setQuestion] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("county");
    const c = research.counties.find((x) => x.fips === q);
    if (c) {
      setMode("county");
      setCounty(c.name);
    }
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="Agentic briefing"
        title="Policy and operations briefing"
        description="Google Gemini looks up the dated policy timeline, current alerts, county research and the FEI, then writes a cited briefing with actions for this week. It explains and retrieves; it never computes a number, and every figure names its source."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="What do you need?">
          <div className="space-y-3">
            <Field label="Briefing type">
              <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="briefing">Weekly policy & operations briefing</option>
                <option value="county">County briefing</option>
                <option value="ask">Ask a question</option>
              </Select>
            </Field>
            {mode === "county" && <CountyAlertSelect value={county} onChange={setCounty} />}
            {mode === "ask" && (
              <>
                <Field label="Question">
                  <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Ask about policy, counties or alerts" />
                </Field>
                <div className="space-y-1">
                  {EXAMPLES.map((q) => (
                    <button key={q} onClick={() => setQuestion(q)} className="block text-left text-[12.5px] text-accent hover:underline">
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <SourceNote>
            Tools: policy timeline (docs/reference/policy_events.csv), county profiles and rankings (research bundle), FEI method,
            and this workspace&apos;s alerts and network totals. Runs server-side; without an API key it returns an offline
            briefing built from the same facts.
          </SourceNote>
        </Card>
        <AgentPanel
          mode={mode}
          county={mode === "county" ? county : undefined}
          question={mode === "ask" ? question : undefined}
          label={mode === "ask" ? "Ask" : "Generate briefing"}
        />
      </div>
      <BriefLibrary />
    </>
  );
}
