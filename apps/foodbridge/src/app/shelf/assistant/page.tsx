"use client";

import { useState } from "react";
import { AgentPanel } from "@/components/AgentPanel";
import { BriefLibrary } from "@/components/BriefLibrary";
import { Card, Field, Input, PageHeader, SourceNote } from "@/components/ui";
import { useData } from "@/components/DataProvider";

export default function ShelfAssistant() {
  const { session } = useData();
  const [question, setQuestion] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="Assistant"
        title="What does next month look like for us?"
        description="The assistant reads the selected shelf or county network's forecast and alerts, the county's research profile and the policy timeline, then explains what to prepare for and what to ask the food bank for. It never decides eligibility or quotes benefit amounts."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Shelf briefing">
          <AgentPanel mode="shelf" shelfId={session.shelfId} label="Brief me on next month" />
        </Card>
        <Card title="Ask a question">
          <Field label="Question">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="e.g. Should we add a second distribution day in August?" />
          </Field>
          <div className="mt-3">
            <AgentPanel mode="ask" shelfId={session.shelfId} question={question} label="Ask" />
          </div>
          <SourceNote>Questions about a person&apos;s eligibility or benefits go to the program or a staff member, not the assistant.</SourceNote>
        </Card>
      </div>
      <BriefLibrary />
    </>
  );
}
