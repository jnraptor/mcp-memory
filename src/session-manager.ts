import { DurableObject } from "cloudflare:workers";

export interface SessionData {
    id: string;
    userId: string;
    createdAt: number;
    lastActivity: number;
    metadata: Record<string, any>;
}

export class SessionManager extends DurableObject {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;
        const path = url.pathname;

        try {
            switch (method) {
                case "POST":
                    if (path === "/create") {
                        return await this.createSession(request);
                    } else if (path === "/update") {
                        return await this.updateSession(request);
                    } else if (path === "/get") {
                        return await this.getSession(request);
                    }
                    break;
                
                case "DELETE":
                    if (path === "/delete") {
                        return await this.deleteSession(request);
                    }
                    break;
                
                case "GET":
                    if (path === "/cleanup") {
                        return await this.cleanupSessions();
                    }
                    break;
            }

            return new Response("Not found", { status: 404 });
        } catch (error) {
            console.error("SessionManager error:", error);
            return new Response("Internal error", { status: 500 });
        }
    }

    private async createSession(request: Request): Promise<Response> {
        const { sessionId, userId, metadata = {} } = await request.json();

        const sessionData: SessionData = {
            id: sessionId,
            userId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            metadata,
        };

        await this.ctx.storage.put(sessionId, sessionData);

        return new Response(JSON.stringify(sessionData), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async updateSession(request: Request): Promise<Response> {
        const { sessionId, metadata } = await request.json();

        const session = await this.ctx.storage.get<SessionData>(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        session.lastActivity = Date.now();
        if (metadata) {
            session.metadata = { ...session.metadata, ...metadata };
        }

        await this.ctx.storage.put(sessionId, session);

        return new Response(JSON.stringify(session), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async getSession(request: Request): Promise<Response> {
        const { sessionId } = await request.json();

        const session = await this.ctx.storage.get<SessionData>(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        // Update last activity
        session.lastActivity = Date.now();
        await this.ctx.storage.put(sessionId, session);

        return new Response(JSON.stringify(session), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async deleteSession(request: Request): Promise<Response> {
        const { sessionId } = await request.json();

        const session = await this.ctx.storage.get<SessionData>(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        await this.ctx.storage.delete(sessionId);

        return new Response("Session deleted", { status: 200 });
    }

    private async cleanupSessions(): Promise<Response> {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let cleanedCount = 0;
        let activeSessions = 0;

        // Get all sessions from storage
        const sessions = await this.ctx.storage.list<SessionData>();
        
        for (const [sessionId, session] of sessions) {
            if (now - session.lastActivity > maxAge) {
                await this.ctx.storage.delete(sessionId);
                cleanedCount++;
            } else {
                activeSessions++;
            }
        }

        return new Response(
            JSON.stringify({ 
                message: "Cleanup completed", 
                cleanedSessions: cleanedCount,
                activeSessions: activeSessions
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }
}