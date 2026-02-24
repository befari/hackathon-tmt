# Superior TMT — AI-Powered Threat Modeling Tool

An AI-assisted threat modeling tool that analyzes source code, generates Data Flow Diagrams (DFDs), enumerates STRIDE threats, and provides a collaborative review surface for security engineers.

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)
- Azure OpenAI API access

### Setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Copy environment config
cp .env.example packages/backend/.env

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run db:migrate

# 5. Start development servers
npm run dev:backend   # Backend on :3001
npm run dev:frontend  # Frontend on :5173
```

## Architecture

```
Frontend (React + React Flow + Fluent UI)
    ↕ REST API + WebSocket
Backend (Node.js + Express + Prisma)
    ↕
PostgreSQL + pgvector
    ↕
Azure OpenAI (GPT-4o)
```

## Features

- **DFD Generation** — AI analyzes source code and generates interactive Data Flow Diagrams
- **STRIDE Threats** — Automated threat enumeration with severity ratings
- **Review Mode** — Inline comments on DFD elements and threats (ADO PR-style)
- **AI Chat** — Conversational Q&A about architecture and threats with RAG context
- **Review Iterations** — Track security reviews across annual cycles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, React Flow, Fluent UI v9, Zustand |
| Backend | Node.js, TypeScript, Express, Prisma |
| Database | PostgreSQL + pgvector |
| AI | Azure OpenAI (GPT-4o/4.1) |
