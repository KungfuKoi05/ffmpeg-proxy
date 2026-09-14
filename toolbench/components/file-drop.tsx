"use client";

import { useCallback, useRef, useState } from "react";

/**
 * File input with drag-and-drop. Keyboard accessible: the whole zone is a
 * button, so it works without a mouse -- a plain styled div with a hidden
 * input usually isn't reachable at all.
 */
export function FileDrop({
  accept, multiple, onFiles, label, hint, disabled,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors disabled:opacity-50 ${
          dragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]"
        }`}
      >
        <span className="text-[15px] font-medium">{label}</span>
        {hint ? <span className="mt-1 text-[13px] text-[var(--ink-3)]">{hint}</span> : null}
        <span className="mt-2 text-[12.5px] text-[var(--ink-3)]">
          or drag {multiple ? "files" : "a file"} here
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

export function FileRow({
  name, detail, onRemove, actions,
}: {
  name: string;
  detail?: string;
  onRemove?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-[var(--line-2)] px-4 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{name}</div>
        {detail ? <div className="text-[12px] text-[var(--ink-3)]">{detail}</div> : null}
      </div>
      {actions}
      {onRemove ? (
        <button
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="rounded-lg px-2 py-1 text-[13px] text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--crit)]"
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}

/** Triggers a browser download from an in-memory blob. Nothing is uploaded. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
