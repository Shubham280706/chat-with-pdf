# PDF Chat — AI-Powered Document Assistant

> Chat with your PDFs using RAG (Retrieval-Augmented Generation) — built from scratch without LangChain.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-green?style=flat-square&logo=supabase)
![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3-orange?style=flat-square)

---

## What is this?

PDF Chat lets you upload any PDF and ask questions about it in natural language. Instead of searching through pages manually, just ask — and get accurate answers with sources showing exactly which part of the document was used.

Built to understand RAG properly — every step implemented from scratch, no LangChain abstractions.

---

## Features

- **Multi-PDF support** — upload multiple PDFs and query across all of them
- **Source transparency** — every answer shows which document chunks were used
- **Persistent storage** — PDFs and embeddings persist across sessions via Supabase
- **Real-time progress** — animated upload progress bar per document
- **Markdown rendering** — answers render with proper formatting
- **Copy answers** — one-click copy for any response
- **Delete documents** — remove individual PDFs from the knowledge base
- **ChatGPT-style UI** — clean dark interface, centered chat, sidebar document library

---

## How it works

```
PDF Upload
    ↓
Text extraction (unpdf)
    ↓
Chunking (400 words, 50 word overlap)
    ↓
Local embeddings (Xenova all-MiniLM-L6-v2, 384 dimensions)
    ↓
Store in Supabase pgvector
    ↓
User asks question
    ↓
Embed question → similarity search → top chunks retrieved
    ↓
Chunks injected into prompt → Groq LLaMA answers
    ↓
Answer + sources returned
```

No LangChain. No magic. Just clean code you can actually understand.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Embeddings | Xenova `all-MiniLM-L6-v2` (local, free) |
| Vector DB | Supabase pgvector |
| LLM | Groq — LLaMA 3.3 70B Versatile |
| PDF Parsing | unpdf |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Groq API key (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/Shubham2806/chat-with-pdf.git
cd chat-with-pdf
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

Run these SQL commands in your Supabase SQL editor:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Create documents table
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(384),
  file_id text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Create similarity search function
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

-- Create index for fast search
create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

### 4. Environment variables

Create `.env.local` in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
chat-with-pdf/
├── app/
│   ├── page.tsx              ← Main UI
│   └── api/
│       ├── ingest/route.ts   ← PDF → chunks → embeddings → Supabase
│       ├── chat/route.ts     ← question → search → LLM → answer
│       ├── delete/route.ts   ← Remove PDF chunks from Supabase
│       └── pdfs/route.ts     ← Fetch uploaded PDFs list
├── lib/
│   ├── embeddings.ts         ← Xenova local embedding model
│   ├── supabase.ts           ← Supabase client
│   └── chunker.ts            ← Text splitting logic
└── .env.local
```

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## What I learned building this

- How RAG works end-to-end without abstractions
- Vector embeddings and cosine similarity search
- pgvector in Supabase for production vector storage
- Chunking strategies and overlap for better retrieval
- Prompt injection for grounded LLM responses
- Why LangChain hides too much and when to go raw

---

## Author

**Shubham Shah** — [GitHub](https://github.com/Shubham2806) · [LinkedIn](https://linkedin.com/in/shubham2806)

---

## License

MIT