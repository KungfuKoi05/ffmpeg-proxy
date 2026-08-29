"use client";

import { useCallback, useEffect, useState } from "react";

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] ${className}`}>
      {children}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-[var(--ink-2)]">
      {children}
    </label>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      spellCheck={false}
      {...props}
      className={
        "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-[14px] " +
        "leading-relaxed outline-none placeholder:text-[var(--ink-3)] " +
        "focus:border-[var(--accent)] " + (props.className ?? "")
      }
    />
  );
}

export function NumberField({
  id, label, value, onChange, min, max, step, suffix, prefix,
}: {
  id: string; label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; suffix?: string; prefix?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        {prefix ? <span className="text-[14px] text-[var(--ink-3)]">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min} max={max} step={step}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[var(--accent)]"
        />
        {suffix ? <span className="whitespace-nowrap text-[13px] text-[var(--ink-3)]">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function Select({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-[var(--ink-2)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

export function Button({
  variant = "primary", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base = "rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors disabled:opacity-40";
  const styles = variant === "primary"
    ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-ink)]"
    : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]";
  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
}

/** Copy with real feedback -- a button that says nothing happened is a bug. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  const copy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }, [text]);

  return (
    <Button variant="ghost" onClick={copy} disabled={!text} aria-live="polite">
      {state === "done" ? "Copied" : state === "failed" ? "Press Ctrl+C" : label}
    </Button>
  );
}

export function DownloadButton({
  text, filename, label = "Download",
}: { text: string; filename: string; label?: string }) {
  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <Button variant="ghost" onClick={download} disabled={!text}>{label}</Button>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[11.5px] text-[var(--ink-3)]">{hint}</div> : null}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-[var(--crit)]/10 px-3 py-2 text-[13px] text-[var(--crit)]">
      {children}
    </p>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-[var(--ink-3)]">{children}</p>;
}

/** Shared layout for the paste-in / get-out tools. */
export function InOutTool({
  input, setInput, output, controls, stats, error, placeholder, downloadName,
}: {
  input: string;
  setInput: (v: string) => void;
  output: string;
  controls?: React.ReactNode;
  stats?: React.ReactNode;
  error?: string;
  placeholder?: string;
  downloadName?: string;
}) {
  return (
    <div className="space-y-3">
      {controls ? <div className="flex flex-wrap items-end gap-3">{controls}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="tool-input">Your text</Label>
          <TextArea
            id="tool-input"
            rows={12}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder ?? "Paste your text here…"}
          />
        </div>
        <div>
          <Label htmlFor="tool-output">Result</Label>
          <TextArea id="tool-output" rows={12} value={output} readOnly
            className="bg-[var(--surface-2)]" placeholder="Your result appears here." />
        </div>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {stats}
      <div className="flex flex-wrap gap-2">
        <CopyButton text={output} label="Copy result" />
        {downloadName ? <DownloadButton text={output} filename={downloadName} /> : null}
        <Button variant="ghost" onClick={() => setInput("")} disabled={!input}>Clear</Button>
      </div>
    </div>
  );
}
