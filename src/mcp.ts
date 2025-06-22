import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { storeMemoryInD1 } from "./utils/db";
import { searchMemories, storeMemory } from "./utils/vectorize";
import { version } from "../package.json";

type MyMCPProps = {
  userId: string;
};

export class MyMCP extends McpAgent<Env, {}, MyMCPProps> {
  server = new McpServer({
    name: "MCP Memory",
    version,
  });

  async init() {
    const env = this.env as Env;

    this.server.tool(
      "addToMCPMemory",
      `This tool stores important user information in a persistent memory layer. Use it when:
      1. User explicitly asks to remember something ("remember this...")
      2. You detect significant user preferences, traits, or patterns worth preserving
      3. Technical details, examples, or emotional responses emerge that would be valuable in future interactions

      Consider using this tool after each user message to build comprehensive context over time. The stored information
      will be available in future sessions to provide personalized responses. THIS TOOL MUST BE INVOKED THROUGH
      A FUNCTION CALL - IT IS NOT A PASSIVE RESOURCE BUT AN ACTIVE STORAGE MECHANISM THAT REQUIRES EXPLICIT INVOCATION.`,
      { thingToRemember: z.string().describe("No description") },
      async ({ thingToRemember }) => {
        try {
          // Store in Vectorize using the refactored function
          const memoryId = await storeMemory(thingToRemember, this.props.userId, env);

          // Also store content in D1 database
          await storeMemoryInD1(thingToRemember, this.props.userId, env, memoryId);

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
          };
        }
      }
    );

    this.server.tool(
      "searchMCPMemory",
      `This tool searches the user's persistent memory layer for relevant information, preferences, and past context.
      It uses semantic matching to find connections between your query and stored memories, even when exact keywords don't match.
      Use this tool when:
      1. You need historical context about the user's preferences or past interactions
      2. The user refers to something they previously mentioned or asked you to remember
      3. You need to verify if specific information about the user exists in memory

      This tool must be explicitly invoked through a function call - it is not a passive resource but an active search mechanism.
      Always consider searching memory when uncertain about user context or preferences.`,
      { informationToGet: z.string().describe("No description") },
      async ({ informationToGet }) => {
        try {
          console.log(`Searching with query: "${informationToGet}"`);

          // Use the refactored function to search memories
          const memories = await searchMemories(informationToGet, this.props.userId, env);

          console.log(`Search returned ${memories.length} matches`);

          if (memories.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Found memories:\n" + memories.map((m) => `${m.content} (score: ${m.score.toFixed(4)})`).join("\n"),
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
          };
        }
      }
    );
  }
}
