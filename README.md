# documind-web

Next.js frontend for **DocuMind**, a production-style RAG application for document Q&A.

🔗 **Live app:** [documind-web-mu.vercel.app](https://documind-web-mu.vercel.app)
🔗 **Backend repo:** [documind-api](https://github.com/AditiV05/documind-api)

---

## What it does

A simple three-step interface:

1. **Upload PDF** — sends a PDF to the backend for storage and processing
2. **Extract & Chunk** — triggers extraction, chunking, and embedding generation
3. **Ask a Question** — sends a query and streams back a citation-grounded answer via Server-Sent Events

---

## Tech stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Deploy:** Vercel
- **Backend:** [documind-api](https://github.com/AditiV05/documind-api) — FastAPI on Railway

---

## Local setup

**Prerequisites:** Node.js 18+, the [documind-api](https://github.com/AditiV05/documind-api) backend running (locally or deployed).

```bash
# Clone and enter
git clone https://github.com/AditiV05/documind-web.git
cd documind-web

# Install
npm install

# Configure
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE to your backend URL
# (defaults to http://localhost:8000 if unset)

# Run
npm run dev
```

App runs at `http://localhost:3000`.

---

## Environment variables

| Variable               | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE` | URL of the documind-api backend (defaults to `http://localhost:8000`) |

---

## Project structure

```
documind-web/
├── app/
│   ├── page.tsx          # Main UI (3 cards: Upload, Extract, Ask)
│   ├── lib/
│   │   └── api.ts        # Backend API client (with SSE streaming)
│   └── layout.tsx
├── public/
├── package.json
└── next.config.js
```
