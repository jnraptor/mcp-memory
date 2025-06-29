import { DurableObject } from "cloudflare:workers";

export interface SessionData {
    id: string;
    userId: string;
    createdAt: number;
    lastActivity: number;
    metadata: Record<string, any>;
}

export class SessionManager extends DurableObject {
    private sessions = new Map<string, SessionData>();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        
        // Load existing sessions from storage
        this.ctx.blockConcurrencyWhile(async () => {
            const stored = await this.ctx.storage.list<SessionData>();
            for (const [key, value] of stored) {
                this.sessions.set(key, value);
            }
        });
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

        this.sessions.set(sessionId, sessionData);
        await this.ctx.storage.put(sessionId, sessionData);

        return new Response(JSON.stringify(sessionData), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async updateSession(request: Request): Promise<Response> {
        const { sessionId, metadata } = await request.json();

        const session = this.sessions.get(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        session.lastActivity = Date.now();
        if (metadata) {
            session.metadata = { ...session.metadata, ...metadata };
        }

        this.sessions.set(sessionId, session);
        await this.ctx.storage.put(sessionId, session);

        return new Response(JSON.stringify(session), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async getSession(request: Request): Promise<Response> {
        const { sessionId } = await request.json();

        const session = this.sessions.get(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        // Update last activity
        session.lastActivity = Date.now();
        this.sessions.set(sessionId, session);
        await this.ctx.storage.put(sessionId, session);

        return new Response(JSON.stringify(session), {
            headers: { "Content-Type": "application/json" },
        });
    }

    private async deleteSession(request: Request): Promise<Response> {
        const { sessionId } = await request.json();

        const session = this.sessions.get(sessionId);
        if (!session) {
            return new Response("Session not found", { status: 404 });
        }

        this.sessions.delete(sessionId);
        await this.ctx.storage.delete(sessionId);

        return new Response("Session deleted", { status: 200 });
    }

    private async cleanupSessions(): Promise<Response> {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > maxAge) {
                this.sessions.delete(sessionId);
                await this.ctx.storage.delete(sessionId);
                cleanedCount++;
            }
        }

        return new Response(
            JSON.stringify({ 
                message: "Cleanup completed", 
                cleanedSessions: cleanedCount,
                activeSessions: this.sessions.size
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }
}