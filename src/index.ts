import { Hono } from "hono";
import { MyMCP } from "./mcp";
import { getAllMemoriesFromD1, initializeDatabase, deleteMemoryFromD1, updateMemoryInD1 } from "./utils/db";
import { deleteVectorById, updateMemoryVector } from "./utils/vectorize";

const app = new Hono<{
  Bindings: Env;
}>();

// Initialize database once
let dbInitialized = false;

// Middleware for one-time database initialization
app.use("*", async (c, next) => {
  if (!dbInitialized) {
    try {
      console.log("Attempting database initialization...");
      await initializeDatabase(c.env);
      dbInitialized = true;
      console.log("Database initialized successfully.");
    } catch (e) {
      console.error("Failed to initialize D1 database:", e);
    }
  }
  await next();
});

// index.html
app.get("/", async (c) => await c.env.ASSETS.fetch(c.req.raw));

// Get all memories for a user
app.get("/:userId/memories", async (c) => {
  const userId = c.req.param("userId");

  try {
    const memories = await getAllMemoriesFromD1(userId, c.env);
    return c.json({ success: true, memories });
  } catch (error) {
    console.error("Error retrieving memories:", error);
    return c.json({ success: false, error: "Failed to retrieve memories" }, 500);
  }
});

// Delete a memory for a user
app.delete("/:userId/memories/:memoryId", async (c) => {
  const userId = c.req.param("userId");
  const memoryId = c.req.param("memoryId");

  try {
    // 1. Delete from D1
    await deleteMemoryFromD1(memoryId, userId, c.env);
    console.log(`Deleted memory ${memoryId} for user ${userId} from D1.`);

    // 2. Delete from Vectorize index
    try {
      await deleteVectorById(memoryId, userId, c.env);
      console.log(`Attempted to delete vector ${memoryId} for user ${userId} from Vectorize.`);
    } catch (vectorError) {
      console.error(`Failed to delete vector ${memoryId} for user ${userId} from Vectorize:`, vectorError);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting memory ${memoryId} (D1 primary) for user ${userId}:`, error);
    return c.json({ success: false, error: "Failed to delete memory" }, 500);
  }
});

// Update a specific memory for a user
app.put("/:userId/memories/:memoryId", async (c) => {
  const userId = c.req.param("userId");
  const memoryId = c.req.param("memoryId");
  let updatedContent: string;

  try {
    // Get updated content from request body
    const body = await c.req.json();
    if (!body || typeof body.content !== "string" || body.content.trim() === "") {
      return c.json({ success: false, error: "Invalid or missing content in request body" }, 400);
    }
    updatedContent = body.content.trim();
  } catch (e) {
    console.error("Failed to parse request body:", e);
    return c.json({ success: false, error: "Failed to parse request body" }, 400);
  }

  try {
    // 1. Update in D1
    await updateMemoryInD1(memoryId, userId, updatedContent, c.env);
    console.log(`Updated memory ${memoryId} for user ${userId} in D1.`);

    // 2. Update vector in Vectorize
    try {
      await updateMemoryVector(memoryId, updatedContent, userId, c.env);
      console.log(`Updated vector ${memoryId} for user ${userId} in Vectorize.`);
    } catch (vectorError) {
      console.error(`Failed to update vector ${memoryId} for user ${userId} in Vectorize:`, vectorError);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error(`Error updating memory ${memoryId} for user ${userId}:`, error);
    const errorMessage = error.message || "Failed to update memory";
    if (errorMessage.includes("not found")) {
      return c.json({ success: false, error: errorMessage }, 404);
    }
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

app.mount("/", async (req, env, ctx) => {
  // Hono's app.mount handler receives the raw Request, not the Hono Context.
  const url = new URL(req.url);
  // Example path: /someUserId/sse
  const pathSegments = url.pathname.split("/");
  // pathSegments will be ["", "someUserId", "sse"]
  const userId = pathSegments[1];

  if (!userId) {
    // Should not happen with Hono routing matching /:userId/, but good practice
    return new Response("Bad Request: Could not extract userId from URL path", { status: 400 });
  }

  // Pass the dynamic userId to the MCP agent's props
  ctx.props = {
    userId: userId,
  };

  // So the full path handled by MCPMemory will be /:userId/sse
  const response = await MyMCP.mount(`/${userId}/sse`).fetch(req, env, ctx);

  if (response) {
    return response;
  }

  // Fallback if MCPMemory doesn't handle the specific request under its mount point
  return new Response("Not Found within MCP mount", { status: 404 });
});

export default app;

export { MyMCP };
