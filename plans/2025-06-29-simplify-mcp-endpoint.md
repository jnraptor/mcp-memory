# Plan: Simplify /mcp Endpoint Using McpAgent

## Current State Analysis

**Current Issues with streamable-http.ts:**
- Custom JSON-RPC 2.0 implementation with 470+ lines of complex code
- Manual session management, error handling, and protocol compliance
- Duplicates functionality already provided by McpAgent
- Higher maintenance burden and potential for protocol violations

**Working McpAgent Implementation (mcp.ts):**
- Clean, simple implementation using `@modelcontextprotocol/sdk`
- Automatic protocol handling via `McpAgent` base class
- Already defines the same two tools: `addToMCPMemory` and `searchMCPMemory`
- Currently mounted at `/:userId/sse` endpoint

**Reference Pattern from Cloudflare AI Demo:**
- Uses `MyMCP.serve("/mcp")` for streamable HTTP endpoints
- Uses `MyMCP.serveSSE("/sse")` for SSE endpoints
- Simple routing with fallback to 404

## Proposed Solution

Replace the complex `StreamableHttpHandler` with direct use of `McpAgent.serve()` method for streamable HTTP support.

### Implementation Steps

1. **Remove streamable-http.ts dependency**
   - Delete `src/streamable-http.ts` file (470 lines of unnecessary code)
   - Remove import from `src/index.ts`

2. **Update /mcp endpoint in index.ts**
   - Replace current handler:
     ```typescript
     // Current complex implementation
     app.all("/:userId/mcp", async (c) => {
       const handler = new StreamableHttpHandler(c.env, userId);
       return await handler.handleRequest(c.req.raw);
     });
     ```
   - With simple McpAgent.serve() call:
     ```typescript
     // New simplified implementation
     app.all("/:userId/mcp", async (c) => {
       const userId = c.req.param("userId");
       const ctx = { props: { userId } };
       return await MyMCP.serve(`/${userId}/mcp`).fetch(c.req.raw, c.env, ctx);
     });
     ```

3. **Maintain backward compatibility**
   - Keep existing `/:userId/sse` endpoint using `MyMCP.mount()` pattern
   - Both endpoints will provide identical functionality

### Benefits

- **Reduced complexity**: Eliminates 470+ lines of custom protocol implementation
- **Better maintainability**: Leverages tested, standardized McpAgent implementation
- **Automatic protocol compliance**: McpAgent handles all JSON-RPC 2.0 and MCP protocol requirements
- **Consistent behavior**: Both `/mcp` and `/sse` endpoints use same underlying agent
- **Lower maintenance burden**: Updates to MCP protocol handled by SDK, not custom code

### Migration Path

1. Deploy the simplified implementation alongside existing code
2. Test that `/mcp` endpoint works correctly with MCP clients
3. Remove `streamable-http.ts` file once confirmed working
4. Eventually deprecate `/sse` endpoint in favor of standardized `/mcp`

## Risk Assessment

**Low Risk Changes:**
- Using proven McpAgent pattern already working in codebase
- No changes to core tool functionality or data storage
- Maintains all existing API contracts

**Testing Required:**
- Verify `/mcp` endpoint accepts JSON-RPC 2.0 requests
- Confirm SSE streaming works for long-running operations
- Test session management and CORS handling
- Validate error responses match expected format