"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnswerSource } from "../lib/api";
import { ChevronIcon, CheckIcon, CopyIcon, Spinner } from "./icons";

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface Message {
  id: string;
  question: string;
  answer: string;
  sources: AnswerSource[];
  status: MessageStatus;
  error?: string;
}

const CITATION = /\s*\[(\d+(?:\s*,\s*\d+)*)\]/g;

// Turn "[1]" / "[1, 2]" markers into links the markdown renderer can hand to us
function linkCitations(text: string) {
  return text.replace(CITATION, (_, nums: string) =>
    nums
      .split(",")
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join(""),
  );
}

function stripCitations(text: string) {
  return text.replace(CITATION, "");
}

export function ChatMessage({
  message,
  onRetry,
}: {
  message: Message;
  onRetry: (question: string) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const sourceRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isStreaming = message.status === "streaming";
  const { sources } = message;

  useEffect(() => {
    if (activeSource === null) return;
    sourceRefs.current[activeSource]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeSource]);

  function showSource(index: number) {
    setSourcesOpen(true);
    setActiveSource(index);
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(stripCitations(message.answer).trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing useful to do
    }
  }

  return (
    <article className="space-y-3">
      {/* Question */}
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white">
          {message.question}
        </p>
      </div>

      {/* Answer */}
      <div className="rounded-2xl rounded-bl-md border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {isStreaming && !message.answer ? (
          <p className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
            <Spinner className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Searching your document…
          </p>
        ) : (
          <div className="text-sm leading-relaxed text-stone-800 dark:text-stone-200 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&>*+*]:mt-3 [&_strong]:font-semibold [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-stone-800">
            <ReactMarkdown
              components={{
                a({ href, children }) {
                  const match = href?.match(/^#cite-(\d+)$/);
                  if (!match) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
                      >
                        {children}
                      </a>
                    );
                  }
                  const index = Number(match[1]) - 1;
                  const source = sources[index];
                  const chip =
                    "mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded px-1 align-middle text-[10px] font-semibold";
                  if (!source) {
                    // Sources arrive after the text finishes streaming
                    return (
                      <span
                        className={`${chip} bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400`}
                      >
                        {match[1]}
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => showSource(index)}
                      title={`Page ${source.page_number}`}
                      aria-label={`Source ${match[1]}, page ${source.page_number}`}
                      className={`${chip} bg-indigo-50 text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white`}
                    >
                      {match[1]}
                    </button>
                  );
                },
              }}
            >
              {linkCitations(message.answer)}
            </ReactMarkdown>
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-indigo-500 align-middle" />
            )}
          </div>
        )}

        {message.status === "stopped" && (
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            Stopped.
          </p>
        )}

        {message.status === "error" && (
          <div
            role="alert"
            className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            <span>{message.error}</span>
            <button
              onClick={() => onRetry(message.question)}
              className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isStreaming && (message.answer || sources.length > 0) && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3 dark:border-stone-800">
            {sources.length > 0 ? (
              <button
                onClick={() => setSourcesOpen((o) => !o)}
                aria-expanded={sourcesOpen}
                className="flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
              >
                <ChevronIcon
                  className={`h-3.5 w-3.5 transition ${sourcesOpen ? "rotate-90" : ""}`}
                />
                {sources.length} source{sources.length > 1 ? "s" : ""}
                <span className="font-normal text-stone-400 dark:text-stone-500">
                  · pages{" "}
                  {[...new Set(sources.map((s) => s.page_number))]
                    .sort((a, b) => a - b)
                    .join(", ")}
                </span>
              </button>
            ) : (
              <span />
            )}
            {message.answer && (
              <button
                onClick={copyAnswer}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                {copied ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        )}

        {sourcesOpen && sources.length > 0 && (
          <ol className="mt-3 space-y-2">
            {sources.map((source, i) => (
              <li
                key={source.id ?? i}
                ref={(el) => {
                  sourceRefs.current[i] = el;
                }}
                className={`rounded-lg border p-3 transition ${
                  activeSource === i
                    ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                    : "border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950/40"
                }`}
              >
                <p className="mb-1 flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <span className="flex h-4 min-w-4 items-center justify-center rounded bg-indigo-100 px-1 text-[10px] dark:bg-indigo-500/20">
                    {i + 1}
                  </span>
                  Page {source.page_number}
                </p>
                <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                  {source.content && source.content.length > 320
                    ? source.content.slice(0, 320).trim() + "…"
                    : source.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
