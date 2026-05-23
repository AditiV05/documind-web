// Base URL of the FASTAPI backend
const API_BASE = "http://localhost:8000";

//shape of the response from the POST /upload
export interface UploadResponse {
  id: string;
  filename: string;
  storage_path: number;
  file_size_bytes: number;
  status: string;
  uploaded_at: string;
}

//shape of the response from POST /extract-and-chunk/{id}
export interface ChunkResponse {
  document_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  avg_chunk_size: number;
  status: string;
}

// upload a PDF file to the backend
export async function uploadPDF(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Uplaod failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

//Trigger extraction + chunking for an uploaded document
export async function extractAndChunk(
  documentId: string,
): Promise<ChunkResponse> {
  const res = await fetch(`${API_BASE}/extract-and-chunk/${documentId}`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Processing failed" }));
    throw new Error(err.detail || "Processing failed");
  }
  return res.json();
}

// Shape of a source in the answer response
export interface AnswerSource {
  id: string;
  document_id: string;
  page_number: number;
  chunk_index: number;
}

// Shape of the response from POST /answer
export interface AnswerResponse {
  query: string;
  answer: string;
  sources: AnswerSource[];
}

// Ask a question — full RAG: retrieve + generate
export async function askQuestion(query: string): Promise<AnswerResponse> {
  const res = await fetch(`${API_BASE}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, match_count: 5 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}
