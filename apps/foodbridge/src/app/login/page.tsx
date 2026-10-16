"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { liveAvailable } from "@/lib/config";
import { browserSupabase } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    const supabase = browserSupabase();
    if (!supabase) return;
    setState("sending");
    try {
      window.localStorage.setItem("foodbridge.prefs.v1", JSON.stringify({ mode: "live" }));
    } catch {
      // ignore
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  };
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-6 block text-center text-[18px] font-semibold text-ink">
          FoodBridge
        </Link>
        <Card title="Sign in to the live workspace" subtitle="We email you a one-time sign-in link. No password to remember.">
          {!liveAvailable ? (
            <p className="text-[13px] text-muted">The live workspace is not configured on this deployment. Use the demo workspace instead.</p>
          ) : state === "sent" ? (
            <p className="text-[14px] text-ink">Check {email} for your sign-in link. You can close this tab.</p>
          ) : (
            <div className="space-y-3">
              <Field label="Work email">
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
              </Field>
              {error && <p className="text-[13px] text-[var(--critical-text)]">{error}</p>}
              <Button onClick={send} disabled={!email || state === "sending"} className="w-full">
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
              <p className="text-[12px] text-muted">
                New accounts wait for a manager to approve them. Shelf coordinators are given access from Manager → Shelves.
              </p>
            </div>
          )}
        </Card>
        <p className="mt-4 text-center text-[13px]">
          <Link
            href="/"
            className="text-accent underline"
            onClick={() => {
              try {
                window.localStorage.setItem("foodbridge.prefs.v1", JSON.stringify({ mode: "demo" }));
              } catch {
                // ignore
              }
            }}
          >
            Back to the demo workspace
          </Link>
        </p>
      </div>
    </main>
  );
}
