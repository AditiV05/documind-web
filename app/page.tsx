"use client";
import { useEffect, useRef, useState } from "react";
import {
  uploadPDF,
  extractAndChunk,
  askQuestionStream,
  deleteDocument,
  UploadResponse,
  ChunkResponse,
} from "./lib/api";
import {
  UploadPanel,
  UploadPhase,
  MAX_FILE_SIZE_MB,
  formatBytes,
} from "./components/UploadPanel";
import { ChatMessage, Message } from "./components/ChatMessage";
import { ThemeToggle } from "./components/ThemeToggle";
import {
  FileIcon,
  SendIcon,
  Spinner,
  StopIcon,
  TrashIcon,
} from "./components/icons";

const AUTO_DELETE_MINUTES = 30;

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key takeaways?",
  "List any dates, deadlines, or figures mentioned",
];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [chunkResult, setChunkResult] = useState<ChunkResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const isReady = !!chunkResult;
  const isAsking = messages.some((m) => m.status === "streaming");

  // Bring each new question into view (not on every token, to avoid jank)
  useEffect(() => {
    if (messages.length) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  useEffect(() => {
    if (isReady) textareaRef.current?.focus();
  }, [isReady]);

  // Reset the two-step delete confirmation if the user doesn't follow through
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  // Cancel any in-flight answer when leaving the page
  useEffect(() => () => abortRef.current?.abort(), []);

  async function processDocument(uploaded: UploadResponse) {
    setPhase("processing");
    try {
      const result = await extractAndChunk(uploaded.id);
      setChunkResult(result);
      setPhase("idle");
    } catch (err) {
      setUploadError(errorMessage(err, "We couldn't read this PDF."));
      setPhase("error");
    }
  }

  async function startUpload(selected: File) {
    setUploadError(null);
    setPhase("uploading");
    try {
      const uploaded = await uploadPDF(selected);
      setUploadResult(uploaded);
      await processDocument(uploaded);
    } catch (err) {
      setUploadError(errorMessage(err, "Upload failed."));
      setPhase("error");
    }
  }

  function handleSelect(selected: File) {
    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFile(null);
      setUploadError("That file isn't a PDF. Please choose a .pdf file.");
      setPhase("error");
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFile(null);
      setUploadError(
        `That file is ${formatBytes(selected.size)}. The limit is ${MAX_FILE_SIZE_MB} MB.`,
      );
      setPhase("error");
      return;
    }
    // A failed earlier attempt may have left an upload behind
    if (uploadResult) deleteDocument(uploadResult.id).catch(() => {});
    setUploadResult(null);
    setChunkResult(null);
    setFile(selected);
    startUpload(selected);
  }

  function handleRetryUpload() {
    if (!file) return;
    // If the upload succeeded but processing failed, only redo processing
    if (uploadResult) {
      setUploadError(null);
      processDocument(uploadResult);
    } else {
      startUpload(file);
    }
  }

  function updateMessage(id: string, patch: (m: Message) => Partial<Message>) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)),
    );
  }

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || isAsking || !uploadResult) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    setQuestion("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMessages((prev) => [
      ...prev,
      { id, question: q, answer: "", sources: [], status: "streaming" },
    ]);
    try {
      await askQuestionStream(
        q,
        uploadResult.id,
        (token) => updateMessage(id, (m) => ({ answer: m.answer + token })),
        (sources) => updateMessage(id, () => ({ sources })),
        () => updateMessage(id, () => ({ status: "done" })),
        controller.signal,
      );
    } catch (err) {
      if (controller.signal.aborted) {
        updateMessage(id, () => ({ status: "stopped" }));
      } else {
        updateMessage(id, () => ({
          status: "error",
          error: errorMessage(err, "Something went wrong."),
        }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function handleDelete() {
    if (!uploadResult) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    setIsDeleting(true);
    setDeleteError(null);
    abortRef.current?.abort();
    try {
      await deleteDocument(uploadResult.id);
      setFile(null);
      setUploadResult(null);
      setChunkResult(null);
      setMessages([]);
      setQuestion("");
      setPhase("idle");
    } catch (err) {
      setDeleteError(errorMessage(err, "Delete failed."));
    } finally {
      setIsDeleting(false);
    }
  }

  const expiresAt = uploadResult
    ? new Date(
        new Date(uploadResult.uploaded_at).getTime() +
          AUTO_DELETE_MINUTES * 60 * 1000,
      )
    : null;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {/* Header */}
        <header className="flex items-center gap-3 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <FileIcon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">DocuMind</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Ask questions about any PDF, with answers cited to the page.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {!isReady ? (
          <div className="flex flex-1 flex-col justify-center pb-24">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Chat with your document
              </h2>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                Upload a PDF and we&apos;ll index it so you can ask anything
                about it.
              </p>
            </div>
            <UploadPanel
              phase={phase}
              file={file}
              error={uploadError}
              onSelect={handleSelect}
              onRetry={handleRetryUpload}
            />
            <p className="mt-6 text-center text-xs text-stone-400 dark:text-stone-500">
              Your document is private and automatically deleted after{" "}
              {AUTO_DELETE_MINUTES} minutes.
            </p>
          </div>
        ) : (
          <>
            {/* Active document */}
            <div className="sticky top-0 z-10 -mx-4 bg-stone-50/90 px-4 pb-3 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-stone-950/90">
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <FileIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {chunkResult.filename}
                  </p>
                  <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                    {chunkResult.page_count} page
                    {chunkResult.page_count === 1 ? "" : "s"}
                    {uploadResult && ` · ${formatBytes(uploadResult.file_size_bytes)}`}
                    {expiresAt &&
                      !isNaN(expiresAt.getTime()) &&
                      ` · auto-deletes at ${expiresAt.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                  </p>
                </div>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    confirmDelete
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "text-stone-600 hover:bg-red-50 hover:text-red-700 dark:text-stone-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  }`}
                >
                  {isDeleting ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <TrashIcon className="h-3.5 w-3.5" />
                  )}
                  {isDeleting
                    ? "Deleting…"
                    : confirmDelete
                      ? "Confirm delete"
                      : "Delete"}
                </button>
              </div>
              {deleteError && (
                <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {deleteError}
                </p>
              )}
            </div>

            {/* Conversation */}
            <div className="flex-1 space-y-6 py-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium">Ready — ask anything.</p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Answers cite the passages they come from. Try one of these:
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs text-stone-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} onRetry={ask} />
              ))}
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-stone-50 from-70% to-transparent px-4 pb-5 pt-4 sm:-mx-6 sm:px-6 dark:from-stone-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="flex items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-stone-700 dark:bg-stone-900 dark:focus-within:ring-indigo-500/20"
              >
                <label htmlFor="question" className="sr-only">
                  Ask a question about your document
                </label>
                <textarea
                  id="question"
                  ref={textareaRef}
                  rows={1}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      ask(question);
                    }
                  }}
                  placeholder="Ask a question about your document…"
                  className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-stone-400 focus:outline-none dark:placeholder:text-stone-500"
                />
                {isAsking ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop generating"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-white transition hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white"
                  >
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!question.trim()}
                    aria-label="Ask"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <SendIcon />
                  </button>
                )}
              </form>
              <p className="mt-2 text-center text-[11px] text-stone-400 dark:text-stone-500">
                Enter to send · Shift + Enter for a new line
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
