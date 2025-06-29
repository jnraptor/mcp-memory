#!/bin/bash

# Test script for streamable HTTP MCP endpoint
# Usage: ./test-streamable-http.sh [base_url] [user_id]

BASE_URL="${1:-http://localhost:8787}"
USER_ID="${2:-testuser}"
ENDPOINT="$BASE_URL/$USER_ID/mcp"

echo "Testing Streamable HTTP MCP at: $ENDPOINT"
echo "========================================="

# Test 1: Initialize
echo "1. Testing initialize..."
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":"1"}' | jq .

echo -e "\n"

# Test 2: Tools list
echo "2. Testing tools/list..."
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":"2"}' | jq .

echo -e "\n"

# Test 3: Capabilities (GET)
echo "3. Testing capabilities (GET)..."
curl -s -X GET "$ENDPOINT?capabilities=true" \
  -H "Accept: application/json" | jq .

echo -e "\n"

# Test 4: SSE Stream (limited duration)
echo "4. Testing SSE stream (3 seconds)..."
timeout 3 curl -s -X GET "$ENDPOINT" \
  -H "Accept: text/event-stream" \
  --no-buffer || echo "SSE stream ended"

echo -e "\n"

# Test 5: Tool call (will fail in local dev without auth)
echo "5. Testing tool call (expect auth error in local dev)..."
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"type":"tool","name":"addToMCPMemory","arguments":{"thingToRemember":"Test memory"}},"id":"3"}' | jq .

echo -e "\nTest completed!"