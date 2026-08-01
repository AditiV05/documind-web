"use client";
import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  uploadPDF,
  extractAndChunk,
  askQuestion,
  askQuestionStream,
  deleteDocument,
  UploadResponse,
  ChunkResponse,
  AnswerResponse,
  AnswerSource,
} from "./lib/api";

type StepState = "done" | "active" | "pending";

function StepBadge({ n, state }: { n: number; state: StepState }) {
  if (state === "done") {
    return (
      <span
        aria-label={`Step ${n} complete`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        aria-label={`Step ${n}, current`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-indigo-600 text-sm font-medium text-indigo-600"
      >
        {n}
      </span>
    );
  }
  return (
    <span
      aria-label={`Step ${n}, locked`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-300 text-sm font-medium text-stone-500"
    >
      {n}
    </span>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [chunkResult, setChunkResult] = useState<ChunkResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [streamedSources, setStreamedSources] = useState<AnswerSource[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setUploadResult(null);
    setChunkResult(null);
    setAnswer(null);
    setStreamedAnswer("");
    setStreamedSources([]);
    setAskedQuestion("");
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadPDF(file);
      setUploadResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleProcess() {
    if (!uploadResult) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await extractAndChunk(uploadResult.id);
      setChunkResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setIsAsking(true);
    setError(null);
    setAnswer(null);
    setStreamedAnswer("");
    setStreamedSources([]);
    setAskedQuestion(q);
    setQuestion("");
    try {
      await askQuestionStream(
        q,
        uploadResult?.id ?? null,
        (token) => setStreamedAnswer((prev) => prev + token),
        (sources) => setStreamedSources(sources),
        () => setIsAsking(false),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setIsAsking(false);
    }
  }

  async function handleDelete() {
    if (!uploadResult) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteDocument(uploadResult.id);
      setFile(null);
      setUploadResult(null);
      setChunkResult(null);
      setAnswer(null);
      setStreamedAnswer("");
      setStreamedSources([]);
      setAskedQuestion("");
      setQuestion("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  const step1: StepState = uploadResult ? "done" : "active";
  const step2: StepState = chunkResult
    ? "done"
    : uploadResult
      ? "active"
      : "pending";
  const step3: StepState = chunkResult ? "active" : "pending";
  const cleanAnswer = streamedAnswer.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "");

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M14 3v4a1 1 0 001 1h4" />
              <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">DocuMind</h1>
            <p className="text-sm text-stone-500">
              Upload a document and ask it anything.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <StepBadge n={1} state={step1} />
              <h2 className="font-medium">Upload PDF</h2>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isUploading || isProcessing}
              className="mb-4 block w-full cursor-pointer text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? "Uploading…" : "Upload"}
            </button>
            {uploadResult && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-stone-500">
                  <span className="font-medium text-stone-700">
                    {uploadResult.filename}
                  </span>{" "}
                  uploaded.
                </p>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeleting ? "Deleting…" : "Delete now"}
                </button>
              </div>
            )}
          </section>

          {/* Step 2 */}
          <section
            className={`rounded-2xl border border-stone-200 bg-white p-6 transition ${
              step2 === "pending" ? "opacity-50" : ""
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <StepBadge n={2} state={step2} />
              <h2 className="font-medium">Extract &amp; chunk</h2>
            </div>
            <button
              onClick={handleProcess}
              disabled={!uploadResult || isProcessing}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessing ? "Processing…" : "Extract & chunk"}
            </button>
            {chunkResult && (
              <p className="mt-4 text-sm text-stone-500">
                <span className="font-medium text-stone-700">
                  {chunkResult.chunk_count} chunks
                </span>{" "}
                from {chunkResult.page_count} page
                {chunkResult.page_count > 1 ? "s" : ""} · ready to query.
              </p>
            )}
          </section>

          {/* Step 3 */}
          <section
            className={`rounded-2xl border border-stone-200 bg-white p-6 transition ${
              step3 === "pending" ? "opacity-50" : ""
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <StepBadge n={3} state={step3} />
              <h2 className="font-medium">Ask a question</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="What is this document about?"
                disabled={!chunkResult}
                className="flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-stone-50"
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || isAsking || !chunkResult}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isAsking ? "Thinking…" : "Ask"}
              </button>
            </div>

            {(streamedAnswer || isAsking) && (
              <div
                className="mt-5 rounded-xl bg-stone-50 p-5"
                aria-live="polite"
              >
                {askedQuestion && (
                  <p className="mb-3 text-sm font-medium text-stone-700">
                    {askedQuestion}
                  </p>
                )}
                {isAsking && !streamedAnswer ? (
                  <p className="flex items-center gap-2 text-sm text-stone-500">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-indigo-600" />
                    Searching your document…
                  </p>
                ) : (
                  <div className="text-sm leading-relaxed text-stone-800 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_p]:mt-2 [&_strong]:font-medium [&_code]:rounded [&_code]:bg-stone-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
                    <ReactMarkdown>{cleanAnswer}</ReactMarkdown>
                    {isAsking && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-indigo-500 align-middle" />
                    )}
                  </div>
                )}
                {streamedSources.length > 0 && (
                  <details className="mt-4 border-t border-stone-200 pt-3">
                    <summary className="cursor-pointer list-none text-xs text-stone-500 hover:text-stone-700">
                      {streamedSources.length} source
                      {streamedSources.length > 1 ? "s" : ""}
                      <span className="ml-1 text-stone-400">
                        · click to view
                      </span>
                    </summary>
                    <ol className="mt-3 space-y-3">
                      {streamedSources.map((source, i) => (
                        <li
                          key={source.id ?? i}
                          className="rounded-lg border border-stone-200 bg-white p-3"
                        >
                          <p className="mb-1 text-xs font-medium text-indigo-600">
                            Page {source.page_number}
                          </p>
                          <p className="text-xs leading-relaxed text-stone-600">
                            {source.content && source.content.length > 240
                              ? source.content.slice(0, 240).trim() + "…"
                              : source.content}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            )}
          </section>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="mt-8 text-center text-xs text-stone-400">
          Your document is private and automatically deleted after 30 minutes —
          or delete it now anytime.
        </p>
      </div>
    </main>
  );
}
