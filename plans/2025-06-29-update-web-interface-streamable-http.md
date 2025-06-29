# Plan: Update Web Interface for Streamable HTTP MCP
**Date**: 2025-06-29

## Current State Analysis
The `static/index.html` file currently showcases the **legacy SSE endpoint** (`/:userId/sse`) which uses the deprecated HTTP+SSE pattern. With the new streamable HTTP implementation, we need to update the interface to promote the modern MCP endpoint.

## Current Issues
1. **Outdated Endpoint References**: All client configurations point to `/:userId/sse`
2. **Legacy Protocol Documentation**: Direct API tab explains old HTTP+SSE pattern
3. **Missing Streamable HTTP Info**: No mention of the new JSON-RPC 2.0 endpoint
4. **Configuration Mismatch**: Client configs don't leverage the new streamable HTTP benefits

## Implementation Plan

### Phase 1: Update Primary Endpoint Reference
1. **Change main URL generation** from `/:userId/sse` to `/:userId/mcp`
2. **Update JavaScript variables** to use streamable HTTP endpoint
3. **Maintain backward compatibility** by offering both endpoints as options

### Phase 2: Update Client Configurations
4. **Cursor Configuration**: Update to use streamable HTTP endpoint
5. **Claude Desktop**: Keep existing `mcp-remote` wrapper (supports both protocols)
6. **Claude Code**: Add new tab with `claude mcp add` command configuration for CLI client
7. **Windsurf**: Update to new `serverUrl` pointing to streamable HTTP
8. **Add protocol selection**: Allow users to choose between modern and legacy

### Phase 3: Revamp Direct API Documentation
9. **Replace SSE documentation** with streamable HTTP JSON-RPC 2.0 examples
10. **Add JSON-RPC examples**: Show `initialize`, `tools/list`, `tools/call` requests
11. **Include response type negotiation**: Explain `Accept` header usage
12. **Add session management**: Document `Mcp-Session-Id` header

### Phase 4: UI Enhancements
13. **Add protocol toggle**: Switch between "Modern (Streamable HTTP)" and "Legacy (SSE)"
14. **Update endpoint display**: Show both URLs with clear labeling
15. **Add protocol badges**: Visual indicators for protocol versions
16. **Enhance Direct API tab**: Interactive examples with copy buttons

### Phase 5: Backward Compatibility & Migration
17. **Default to streamable HTTP**: Use modern endpoint as primary
18. **Provide legacy fallback**: Easy access to old SSE endpoint
19. **Add migration notice**: Inform users about protocol upgrade
20. **Update documentation links**: Point to MCP 2025-03-26 spec

## Technical Implementation Details

### JavaScript Changes
- Update UUID-based URL generation to use `/mcp` suffix
- Add protocol selection state management
- Implement dynamic configuration generation based on protocol choice
- Update all copy buttons to handle protocol-specific configurations

### HTML Structure Updates
- Add protocol selection toggle above URL input
- Enhance Direct API tab with JSON-RPC examples
- Update client configuration code blocks
- Add informational badges and migration notices

### Configuration Examples
**New Streamable HTTP configs:**
- Cursor: Direct URL to `/:userId/mcp`
- Claude Code: CLI configuration using `claude mcp add --transport http` command
- Windsurf: `serverUrl` pointing to streamable HTTP
- Direct API: JSON-RPC 2.0 examples with proper headers

**Claude Code Configuration Details:**
```bash
# Add HTTP transport MCP server
claude mcp add --transport http mcp-memory "https://your-deployment.com/userId/mcp"

# Alternative SSE transport (legacy)
claude mcp add --transport sse mcp-memory-sse "https://your-deployment.com/userId/sse"
```
- Uses `claude mcp add` command with `--transport http` for streamable HTTP
- Native MCP support with proper transport specification
- Session management handled automatically
- Can specify scope with `-s user` or `-s project` flags

**Legacy SSE configs:**
- Maintain existing patterns for backward compatibility
- Clear labeling as "Legacy" or "Deprecated"

## Benefits
- **Modern Protocol Adoption**: Encourages use of current MCP standards
- **Better Client Experience**: Streamable HTTP offers improved reliability
- **Educational Value**: Shows users the evolution of MCP protocol
- **Smooth Migration**: Provides clear upgrade path from legacy

## Testing Requirements
- Verify URL generation for both protocols
- Test configuration copy functionality for all clients (Cursor, Claude Desktop, Claude Code, Windsurf)
- Validate JSON-RPC examples are syntactically correct
- Ensure backward compatibility is maintained
- Test UI responsiveness with new toggle elements
- Verify Claude Code tab displays correct CLI commands

**Estimated Effort**: 1-2 days for full implementation and testing