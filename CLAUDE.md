# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development
- `npm run dev` - Start local development server with vectorize bind to production
- `npm run start` - Start local development server (basic)
- `npm run deploy` - Deploy to Cloudflare Workers

### Code Quality
- `npm run format` - Format code using Biome
- `npm run lint:fix` - Lint and auto-fix issues using Biome
- `npm run cf-typegen` - Generate Cloudflare Worker types

### Setup Commands (for new deployments)
```bash
npx wrangler vectorize create mcp-memory-vectorize --dimensions 1024 --metric cosine
```

## Architecture Overview

This is an MCP (Model Context Protocol) Memory Server built on Cloudflare's infrastructure. It provides persistent memory capabilities to MCP clients like Claude, Cursor, and Windsurf.

### Core Components

**MCP Agent (`src/mcp.ts`)**
- Implements MCP protocol via `workers-mcp` and `@modelcontextprotocol/sdk`
- Exposes two main tools: `addToMCPMemory` and `searchMCPMemory`
- Uses Durable Objects (MyMCP class) for stateful operations
- Receives userId via props from the routing layer
- Supports both streamable HTTP (new MCP 2025-03-26) and legacy SSE endpoints

**HTTP API (`src/index.ts`)**
- Hono-based REST API for memory management
- Routes: GET/DELETE/PUT operations on `/:userId/memories`
- **Streamable HTTP MCP endpoint**: `/:userId/mcp` (new MCP 2025-03-26 protocol)
- **Legacy SSE MCP endpoint**: `/:userId/sse` for backward compatibility
- Handles database initialization middleware

**Vector Storage (`src/utils/vectorize.ts`)**
- Uses Cloudflare Workers AI (`@cf/baai/bge-m3`) for text embeddings
- Stores vectors in Cloudflare Vectorize with user namespacing
- Implements semantic search with 0.5 minimum similarity threshold
- Handles vector CRUD operations

**Relational Storage (`src/utils/db.ts`)**
- D1 SQLite database for persistent text storage
- Schema: `memories(id, userId, content, created_at)`
- Provides backup/metadata storage alongside vector embeddings

### Infrastructure Dependencies

**Cloudflare Services Required:**
- Workers (compute)
- D1 Database (SQLite storage)
- Vectorize (vector search)
- Workers AI (text embeddings)
- Durable Objects (state management)
- Rate Limiting (100 req/min per namespace)

### Key Configuration

**Wrangler Configuration (`wrangler.jsonc`):**
- Durable Object binding: `MCP_OBJECT` → `MyMCP` (legacy agent)
- D1 binding: `DB` → database
- Vectorize binding: `VECTORIZE` → index
- Workers AI binding: `AI`
- Rate limiter: 100 requests/60 seconds

**Code Style (Biome):**
- 4-space indentation
- 100 character line width
- Disabled: explicit any, debugger, console.log warnings

### Data Flow

1. **Storage**: Text → Workers AI embedding → Vectorize + D1 storage
2. **Retrieval**: Query → Workers AI embedding → Vectorize search → D1 metadata
3. **User Isolation**: Each user gets isolated namespace in Vectorize and userId filtering in D1

### MCP Protocol Endpoints

**Streamable HTTP (Recommended - MCP 2025-03-26)**
- Endpoint: `/:userId/mcp`
- Uses MyMCP.serve() method for streamable HTTP protocol
- Supports JSON-RPC 2.0 with MCP extensions
- Handles both single responses and streaming via `workers-mcp` framework

**Legacy HTTP+SSE**
- Endpoint: `/:userId/sse` 
- Uses MyMCP.serveSSE() method for traditional SSE-based protocol
- Maintains backward compatibility with older MCP clients

### Development Notes

- Use `wrangler dev --experimental-vectorize-bind-to-prod` for local development with production Vectorize
- Database auto-initializes on first request via middleware
- Vector operations are eventually consistent
- Memory IDs are UUIDs shared between D1 and Vectorize
- Streamable HTTP requires Cloudflare authentication for Workers AI in local dev
- No test suite currently implemented - manual testing via MCP clients recommended

## Planning and Documentation

### Implementation Plans
All implementation plans should be stored in the `plans/` directory using the naming convention:
`YYYY-MM-DD-plan-name.md`

Use the current date as a prefix (get it with `date +%Y-%m-%d`) to maintain chronological order and easy tracking of planning evolution.