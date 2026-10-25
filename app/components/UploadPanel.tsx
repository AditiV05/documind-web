"use client";
import { useRef, useState } from "react";
import { CheckIcon, FileIcon, Spinner, UploadIcon } from "./icons";

export type UploadPhase = "idle" | "uploading" | "processing" | "error";

export const MAX_FILE_SIZE_MB = 10;

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STAGES: { key: "uploading" | "processing"; label: string }[] = [
  { key: "uploading", label: "Uploading" },
  { key: "processing", label: "Reading & indexing pages" },
];

export function UploadPanel({
  phase,
  file,
  error,
  onSelect,
  onRetry,
}: {
  phase: UploadPhase;
  file: File | null;
  error: string | null;
  onSelect: (file: File) => void;
  onRetry: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const busy = phase === "uploading" || phase === "processing";

  function pick(files: FileList | null) {
    const selected = files?.[0];
    if (selected) onSelect(selected);
    // Allow picking the same file again after an error
    if (inputRef.current) inputRef.current.value = "";
  }

  if (busy && file) {
    const current = STAGES.findIndex((s) => s.key === phase);
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <FileIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {formatBytes(file.size)}
            </p>
          </div>
        </div>
        <ol className="space-y-2.5">
          {STAGES.map((stage, i) => {
            const state =
              i < current ? "done" : i === current ? "active" : "pending";
            return (
              <li key={stage.key} className="flex items-center gap-2.5 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center ${
                    state === "done"
                      ? "text-indigo-600 dark:text-indigo-400"
                      : state === "active"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-stone-300 dark:text-stone-600"
                  }`}
                >
                  {state === "done" ? (
                    <CheckIcon />
                  ) : state === "active" ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={
                    state === "pending"
                      ? "text-stone-400 dark:text-stone-500"
                      : "text-stone-700 dark:text-stone-200"
                  }
                >
                  {stage.label}
                  {state === "active" && "…"}
                </span>
              </li>
            );
          })}
        </ol>
        {phase === "processing" && (
          <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
            Large documents can take up to a minute.
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950 ${
          isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
            : "border-stone-300 bg-white hover:border-indigo-400 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-indigo-500 dark:hover:bg-stone-900/60"
        }`}
      >
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <UploadIcon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium">
          <span className="text-indigo-600 dark:text-indigo-400">
            Choose a PDF
          </span>{" "}
          or drag it here
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Up to {MAX_FILE_SIZE_MB} MB · 120 pages
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {phase === "error" && error && (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <p>{error}</p>
          {file && (
            <button
              onClick={onRetry}
              className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
