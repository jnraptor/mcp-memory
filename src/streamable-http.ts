import { v4 as uuidv4 } from "uuid";
import { storeMemoryInD1 } from "./utils/db";
import { searchMemories, storeMemory } from "./utils/vectorize";
import type { SessionData } from "./session-manager";

// JSON-RPC 2.0 types
interface JsonRpcRequest {
    jsonrpc: "2.0";
    method: string;
    params?: any;
    id?: string | number | null;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id: string | number | null;
}

interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: any;
}

// MCP Tool call types
interface ToolCall {
    type: "tool";
    name: string;
    arguments: Record<string, any>;
}

interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}

export class StreamableHttpHandler {
    constructor(
        private env: Env,
        private userId: string
    ) {}

    async handleRequest(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;

        // Handle CORS preflight
        if (method === "OPTIONS") {
            return this.createCorsResponse();
        }

        // Get or create session
        const sessionId = await this.getOrCreateSession(request);
        
        // Handle different HTTP methods
        switch (method) {
            case "POST":
                return this.handlePost(request, sessionId);
            case "GET":
                return this.handleGet(request, sessionId);
            default:
                return new Response("Method not allowed", { status: 405 });
        }
    }

    private async getOrCreateSession(request: Request): Promise<string> {
        const sessionHeader = request.headers.get("Mcp-Session-Id");
        
        if (sessionHeader) {
            // Try to get existing session from Durable Object
            try {
                const sessionManager = this.env.SESSION_MANAGER.get(
                    this.env.SESSION_MANAGER.idFromName(this.userId)
                );
                
                const response = await sessionManager.fetch(new Request("http://dummy/get", {
                    method: "POST",
                    body: JSON.stringify({ sessionId: sessionHeader }),
                    headers: { "Content-Type": "application/json" }
                }));

                if (response.ok) {
                    return sessionHeader;
                }
            } catch (error) {
                console.warn("Failed to retrieve session:", error);
            }
        }

        // Create new session
        const sessionId = uuidv4();
        try {
            const sessionManager = this.env.SESSION_MANAGER.get(
                this.env.SESSION_MANAGER.idFromName(this.userId)
            );
            
            await sessionManager.fetch(new Request("http://dummy/create", {
                method: "POST",
                body: JSON.stringify({ 
                    sessionId, 
                    userId: this.userId,
                    metadata: {}
                }),
                headers: { "Content-Type": "application/json" }
            }));
        } catch (error) {
            console.warn("Failed to create session in Durable Object:", error);
        }
        
        return sessionId;
    }

    private async handlePost(request: Request, sessionId: string): Promise<Response> {
        const acceptHeader = request.headers.get("Accept") || "";
        const supportsJson = acceptHeader.includes("application/json");
        const supportsSSE = acceptHeader.includes("text/event-stream");

        try {
            const body = await request.json() as JsonRpcRequest;
            
            // Validate JSON-RPC structure
            if (!this.isValidJsonRpc(body)) {
                return this.createErrorResponse(
                    { code: -32600, message: "Invalid Request" },
                    body.id || null,
                    sessionId
                );
            }

            // Process the JSON-RPC request
            const result = await this.processJsonRpcRequest(body);
            
            // Decide response type based on Accept header and content
            if (supportsSSE && this.shouldUseSSE(body, result)) {
                return this.createSSEResponse(result, sessionId);
            } else if (supportsJson) {
                return this.createJsonResponse(result, sessionId);
            } else {
                // Default to JSON if no specific Accept header
                return this.createJsonResponse(result, sessionId);
            }

        } catch (error) {
            console.error("Error processing POST request:", error);
            return this.createErrorResponse(
                { code: -32700, message: "Parse error" },
                null,
                sessionId
            );
        }
    }

    private async handleGet(request: Request, sessionId: string): Response {
        // GET requests for SSE streams or capability discovery
        const url = new URL(request.url);
        
        if (url.searchParams.has("capabilities")) {
            return this.createCapabilitiesResponse(sessionId);
        }

        // Default SSE stream for GET requests
        return this.createSSEStream(sessionId);
    }

    private isValidJsonRpc(body: any): body is JsonRpcRequest {
        return (
            body &&
            body.jsonrpc === "2.0" &&
            typeof body.method === "string" &&
            (body.id === undefined || typeof body.id === "string" || typeof body.id === "number" || body.id === null)
        );
    }

    private async processJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
        try {
            // Handle MCP-specific methods
            switch (request.method) {
                case "tools/call":
                    return await this.handleToolCall(request);
                case "tools/list":
                    return this.handleToolsList(request);
                case "initialize":
                    return this.handleInitialize(request);
                default:
                    return {
                        jsonrpc: "2.0",
                        error: { code: -32601, message: "Method not found" },
                        id: request.id || null,
                    };
            }
        } catch (error) {
            console.error("Error processing JSON-RPC request:", error);
            return {
                jsonrpc: "2.0",
                error: { 
                    code: -32603, 
                    message: "Internal error",
                    data: String(error)
                },
                id: request.id || null,
            };
        }
    }

    private async handleToolCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
        const { name, arguments: args } = request.params as ToolCall;

        let result: ToolResult;

        switch (name) {
            case "addToMCPMemory":
                result = await this.addToMCPMemory(args.thingToRemember);
                break;
            case "searchMCPMemory":
                result = await this.searchMCPMemory(args.informationToGet);
                break;
            default:
                return {
                    jsonrpc: "2.0",
                    error: { code: -32601, message: `Unknown tool: ${name}` },
                    id: request.id || null,
                };
        }

        return {
            jsonrpc: "2.0",
            result: result,
            id: request.id || null,
        };
    }

    private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
        return {
            jsonrpc: "2.0",
            result: {
                tools: [
                    {
                        name: "addToMCPMemory",
                        description: "Store important user information in persistent memory",
                        inputSchema: {
                            type: "object",
                            properties: {
                                thingToRemember: {
                                    type: "string",
                                    description: "Information to store in memory"
                                }
                            },
                            required: ["thingToRemember"]
                        }
                    },
                    {
                        name: "searchMCPMemory",
                        description: "Search for relevant information in user's persistent memory",
                        inputSchema: {
                            type: "object",
                            properties: {
                                informationToGet: {
                                    type: "string",
                                    description: "Query to search for in memory"
                                }
                            },
                            required: ["informationToGet"]
                        }
                    }
                ]
            },
            id: request.id || null,
        };
    }

    private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
        return {
            jsonrpc: "2.0",
            result: {
                protocolVersion: "2025-03-26",
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {},
                    logging: {}
                },
                serverInfo: {
                    name: "MCP Memory",
                    version: "1.0.0"
                }
            },
            id: request.id || null,
        };
    }

    private async addToMCPMemory(thingToRemember: string): Promise<ToolResult> {
        try {
            const memoryId = await storeMemory(thingToRemember, this.userId, this.env);
            await storeMemoryInD1(thingToRemember, this.userId, this.env, memoryId);

            console.log(
                `Memory stored successfully in Vectorize and D1 with ID: ${memoryId}, content: "${thingToRemember}"`
            );

            return {
                content: [{ type: "text", text: "Remembered: " + thingToRemember }],
            };
        } catch (error) {
            console.error("Error storing memory:", error);
            return {
                content: [{ type: "text", text: "Failed to remember: " + String(error) }],
                isError: true,
            };
        }
    }

    private async searchMCPMemory(informationToGet: string): Promise<ToolResult> {
        try {
            console.log(`Searching with query: "${informationToGet}"`);

            const memories = await searchMemories(informationToGet, this.userId, this.env);

            console.log(`Search returned ${memories.length} matches`);

            if (memories.length > 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Found memories:\n" + 
                                  memories.map((m) => `${m.content} (score: ${m.score.toFixed(4)})`).join("\n"),
                        },
                    ],
                };
            }

            return {
                content: [{ type: "text", text: "No relevant memories found." }],
            };
        } catch (error) {
            console.error("Error searching memories:", error);
            return {
                content: [{ type: "text", text: "Failed to search memories: " + String(error) }],
                isError: true,
            };
        }
    }

    private shouldUseSSE(request: JsonRpcRequest, response: JsonRpcResponse): boolean {
        // Use SSE for streaming responses or long-running operations
        // For now, we'll use JSON responses for simplicity
        return false;
    }

    private createJsonResponse(result: JsonRpcResponse, sessionId: string): Response {
        const headers = new Headers({
            "Content-Type": "application/json",
            "Mcp-Session-Id": sessionId,
        });

        this.addCorsHeaders(headers);

        return new Response(JSON.stringify(result), {
            status: 202, // HTTP 202 Accepted as per MCP spec
            headers,
        });
    }

    private createSSEResponse(result: JsonRpcResponse, sessionId: string): Response {
        const headers = new Headers({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Mcp-Session-Id": sessionId,
        });

        this.addCorsHeaders(headers);

        const sseData = `data: ${JSON.stringify(result)}\n\n`;

        return new Response(sseData, {
            status: 200,
            headers,
        });
    }

    private createSSEStream(sessionId: string): Response {
        const headers = new Headers({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Mcp-Session-Id": sessionId,
        });

        this.addCorsHeaders(headers);

        // Create a simple SSE stream
        const stream = new ReadableStream({
            start(controller) {
                // Send initial connection message
                const message = `data: ${JSON.stringify({
                    jsonrpc: "2.0",
                    method: "notifications/initialized",
                    params: { sessionId }
                })}\n\n`;
                
                controller.enqueue(new TextEncoder().encode(message));
            }
        });

        return new Response(stream, {
            status: 200,
            headers,
        });
    }

    private createCapabilitiesResponse(sessionId: string): Response {
        const capabilities = {
            protocolVersion: "2025-03-26",
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
                logging: {}
            },
            serverInfo: {
                name: "MCP Memory",
                version: "1.0.0"
            }
        };

        const headers = new Headers({
            "Content-Type": "application/json",
            "Mcp-Session-Id": sessionId,
        });

        this.addCorsHeaders(headers);

        return new Response(JSON.stringify(capabilities), {
            status: 200,
            headers,
        });
    }

    private createErrorResponse(
        error: { code: number; message: string; data?: any },
        id: string | number | null,
        sessionId: string
    ): Response {
        const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            error,
            id,
        };

        const headers = new Headers({
            "Content-Type": "application/json",
            "Mcp-Session-Id": sessionId,
        });

        this.addCorsHeaders(headers);

        return new Response(JSON.stringify(response), {
            status: 400,
            headers,
        });
    }

    private createCorsResponse(): Response {
        const headers = new Headers();
        this.addCorsHeaders(headers);
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID");

        return new Response(null, {
            status: 204,
            headers,
        });
    }

    private addCorsHeaders(headers: Headers): void {
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID");
        headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");
    }
}