"use client";

import { useState } from "react";
import {
  uploadPDF,
  extractAndChunk,
  askQuestion,
  UploadResponse,
  ChunkResponse,
  AnswerResponse,
} from "./lib/api";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [chunkResult, setChunkResult] = useState<ChunkResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    // Reset previous results when a new file is picked
    setUploadResult(null);
    setChunkResult(null);
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
    if (!question.trim()) return;
    setIsAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await askQuestion(question);
      setAnswer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">DocuMind</h1>
        <p className="text-gray-600 mb-8">
          Upload a PDF, extract and chunk it.
        </p>

        {/* Step 1: pick + upload */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="font-semibold mb-3">1. Upload PDF</h2>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm mb-4"
          />
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>

          {uploadResult && (
            <div className="mt-4 text-sm bg-green-50 border border-green-200 rounded p-3">
              <p>
                Uploaded: <strong>{uploadResult.filename}</strong>
              </p>
              <p>
                Document ID: <code>{uploadResult.id}</code>
              </p>
              <p>Status: {uploadResult.status}</p>
            </div>
          )}
        </div>

        {/* Step 2: process */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold mb-3">2. Extract & Chunk</h2>
          <button
            onClick={handleProcess}
            disabled={!uploadResult || isProcessing}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {isProcessing ? "Processing..." : "Extract & Chunk"}
          </button>

          {chunkResult && (
            <div className="mt-4 text-sm bg-green-50 border border-green-200 rounded p-3">
              <p>Pages: {chunkResult.page_count}</p>
              <p>
                Chunks created: <strong>{chunkResult.chunk_count}</strong>
              </p>
              <p>Avg chunk size: {chunkResult.avg_chunk_size} chars</p>
              <p>Status: {chunkResult.status}</p>
            </div>
          )}
        </div>

        {/* Step 3: ask a question */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-4">
          <h2 className="font-semibold mb-3">3. Ask a Question</h2>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask something about the uploaded document..."
            className="block w-full text-sm border border-gray-300 rounded px-3 py-2 mb-4"
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || isAsking}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {isAsking ? "Thinking..." : "Ask"}
          </button>

          {answer && (
            <div className="mt-4 text-sm bg-gray-50 border border-gray-200 rounded p-4">
              <p className="whitespace-pre-wrap">{answer.answer}</p>
              {answer.sources.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Sources: {answer.sources.length} chunk
                  {answer.sources.length > 1 ? "s" : ""} (page
                  {answer.sources.length > 1 ? "s" : ""}{" "}
                  {[...new Set(answer.sources.map((s) => s.page_number))].join(
                    ", ",
                  )}
                  )
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 text-sm bg-red-50 border border-red-200 rounded p-3 text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
