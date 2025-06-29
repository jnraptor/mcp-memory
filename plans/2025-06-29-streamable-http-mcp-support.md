# Plan: Add Streamable HTTP MCP Support
**Date**: 2025-06-29

## Current State Analysis
- **Current Implementation**: Uses deprecated HTTP+SSE pattern via `workers-mcp` library
- **Architecture**: Separate SSE endpoint (`/:userId/sse`) mounted through `McpAgent` 
- **Gap**: Missing streamable HTTP protocol support introduced in MCP 2025-03-26 spec

## What is Streamable HTTP MCP?
Streamable HTTP is the new transport protocol that replaces HTTP+SSE, providing:
- **Single unified endpoint** handling all communication
- **Dynamic response type** selection (JSON or SSE)
- **Session management** via `Mcp-Session-Id` header
- **Better infrastructure compatibility** and simplified implementation

## Implementation Plan

### Phase 1: Core HTTP Streaming Infrastructure
1. **Create streamable HTTP endpoint** (`/mcp` or `/:userId/mcp`)
   - Support both POST and GET methods
   - Handle `Accept` header negotiation (`application/json` + `text/event-stream`)
   - Implement session management via `Mcp-Session-Id` header

2. **Implement JSON-RPC message handling**
   - Parse incoming JSON-RPC requests
   - Route to appropriate MCP tools (addToMCPMemory, searchMCPMemory)
   - Return HTTP 202 Accepted for valid requests

3. **Add response type negotiation**
   - Return `application/json` for single responses
   - Return `text/event-stream` for streaming responses
   - Dynamic switching based on request context

### Phase 2: Session Management & State
4. **Implement session tracking**
   - Use Durable Objects for session state persistence
   - Handle `Mcp-Session-Id` header generation and validation
   - Support session recovery via `Last-Event-ID`

5. **Maintain backward compatibility**
   - Keep existing SSE endpoint functional
   - Add feature detection for client capabilities
   - Gradual migration path

### Phase 3: Integration & Testing
6. **Update routing architecture**
   - Add new streamable HTTP routes alongside existing REST API
   - Integrate with existing rate limiting and authentication
   - Preserve user isolation via userId parameter

7. **Add comprehensive testing**
   - Unit tests for JSON-RPC message handling
   - Integration tests for session management
   - Load testing for concurrent connections

### Phase 4: Documentation & Migration
8. **Update documentation**
   - Add streamable HTTP examples to CLAUDE.md
   - Create migration guide from SSE to HTTP streaming
   - Update API documentation

## Technical Requirements
- **Single HTTP endpoint** supporting POST/GET
- **Header requirements**: `Accept`, `Mcp-Session-Id`, `Last-Event-ID`
- **Response types**: `application/json` or `text/event-stream`
- **JSON-RPC message encoding** with UTF-8
- **Session persistence** via Durable Objects
- **Rate limiting** integration (current: 100 req/min)

## Benefits
- Simplified client implementation
- Better middleware/proxy compatibility
- Flexible connection management
- Enhanced session recovery
- Improved scalability under high concurrency

**Estimated Effort**: 2-3 days for core implementation, 1-2 days for testing and documentation