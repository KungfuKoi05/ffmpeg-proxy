"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, ShieldAlert, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompatibilityBadge, VerificationBadge } from "@/components/ui/signal";
import { PanelHeading } from "@/components/ui/misc";
import { formatMoney } from "@/lib/units";
import type { SerializedProduct } from "@/server/serializers";
import type { ScopeReply } from "@/server/scope";

interface Turn {
  role: "user" | "scope";
  text: string;
  reply?: ScopeReply;
}

const SUGGESTIONS = [
  "Lightweight M-LOK handguard under $200",
  "11.5 barrel for an AR-15",
  "Manufacturer-verified micro red dot",
];

/**
 * SCOPE panel.
 *
 * The assistant only navigates the catalog: the compatibility badge on each
 * candidate comes from the rules engine running against the open
 * configuration, not from the model.
 */
export function ScopePanel({
  buildId,
  onAdd,
  onClose,
}: {
  buildId: string | null;
  onAdd: (product: SerializedProduct) => void;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "scope",
      text: "I search the verified catalog and check candidates against your configuration. Tell me the platform, caliber, budget and what you already own.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/scope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, buildId: buildId ?? undefined }),
      });
      const payload = (await response.json()) as ScopeReply & { error?: { message: string } };
      if (!response.ok) {
        setTurns((current) => [
          ...current,
          { role: "scope", text: payload.error?.message ?? "That request could not be completed." },
        ]);
        return;
      }
      setTurns((current) => [...current, { role: "scope", text: payload.message, reply: payload }]);
    } catch {
      setTurns((current) => [
        ...current,
        { role: "scope", text: "I could not reach the catalog service. Try again in a moment." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <PanelHeading
        title="SCOPE assistant"
        action={
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close SCOPE">
            <X />
          </Button>
        }
      />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {turns.map((turn, index) => (
          <div key={index} className="space-y-2">
            <div
              className={
                turn.role === "user"
                  ? "ml-8 rounded border border-accent/30 bg-accent/10 px-2.5 py-2 text-[11px] text-ink"
                  : "rounded border border-line bg-elevated px-2.5 py-2 text-[11px] leading-relaxed text-ink-muted"
              }
            >
              {turn.role === "scope" ? (
                <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                  <Sparkles className="size-3" /> SCOPE
                </span>
              ) : null}
              {turn.text}
            </div>

            {turn.reply?.refusal ? (
              <div className="rounded border border-signal-red/40 bg-signal-red/10 p-2.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-signal-red">
                  <ShieldAlert className="size-3" /> Outside the product boundary
                </p>
                <ul className="mt-2 space-y-1">
                  {turn.reply.refusal.redirects.map((redirect) => (
                    <li key={redirect.href}>
                      <a href={redirect.href} className="text-[11px] text-accent hover:underline">
                        {redirect.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {turn.reply?.clarifications?.length ? (
              <ul className="space-y-1">
                {turn.reply.clarifications.map((question) => (
                  <li key={question} className="text-[11px] text-ink-faint">
                    · {question}
                  </li>
                ))}
              </ul>
            ) : null}

            {turn.reply?.candidates?.length ? (
              <ul className="space-y-1.5">
                {turn.reply.candidates.slice(0, 5).map((candidate) => (
                  <li
                    key={candidate.product.id}
                    className="rounded border border-line bg-elevated p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-ink">
                          {candidate.product.productName}
                        </p>
                        <p className="truncate text-[10px] text-ink-muted">
                          {candidate.product.manufacturerName} ·{" "}
                          {candidate.product.currentPriceCents === null
                            ? "no price observed"
                            : formatMoney(candidate.product.currentPriceCents, "USD", {
                                showCents: false,
                              })}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="secondary"
                        onClick={() => onAdd(candidate.product)}
                        aria-label={`Add ${candidate.product.productName}`}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <VerificationBadge status={candidate.product.verificationStatus} />
                      {candidate.compatibility ? (
                        <CompatibilityBadge state={candidate.compatibility} />
                      ) : null}
                    </div>
                    {candidate.explanation ? (
                      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
                        {candidate.explanation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {turn.reply && !turn.reply.usedLlm && turn.reply.llmAvailable === false ? (
              <p className="text-[10px] text-ink-faint">
                Parsed locally — no model configured, so filters came from the deterministic parser.
              </p>
            ) : null}
          </div>
        ))}

        {pending ? <p className="text-[11px] text-ink-faint">Searching the catalog…</p> : null}
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded border border-line px-2 py-1 text-[10px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask SCOPE about catalog parts…"
            aria-label="Message SCOPE"
            maxLength={1000}
          />
          <Button type="submit" variant="primary" size="icon" disabled={pending || !input.trim()}>
            <Send />
          </Button>
        </form>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
          SCOPE searches published catalog records. It does not provide manufacturing, machining,
          conversion or loading information.
        </p>
      </div>
    </div>
  );
}

export function ScopeBadge() {
  return <Badge tone="accent">SCOPE</Badge>;
}
