import { v4 as uuidv4 } from "uuid";

// Minimum similarity score for vector search results
const MINIMUM_SIMILARITY_SCORE = 0.5;

/**
 * Generates vector embeddings from text using Cloudflare's AI model
 *
 * @param text - The text to convert into vector embeddings
 * @param env - Environment containing AI service access
 * @returns Promise resolving to an array of numerical values representing the text embedding
 */
async function generateEmbeddings(text: string, env: Env): Promise<number[]> {
  const embeddings = (await env.AI.run("@cf/baai/bge-m3", {
    text,
  })) as AiTextEmbeddingsOutput;

  const values = embeddings.data[0];
  if (!values) throw new Error("Failed to generate vector embedding");

  return values;
}

/**
 * Stores a memory in Vectorize with its vector embedding and returns the generated ID
 * @param text - The memory content to store
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize and AI services
 * @returns Promise resolving to the unique memory ID
 */
export async function storeMemory(text: string, userId: string, env: Env): Promise<string> {
  const memoryId = uuidv4();

  // Generate embedding
  const values = await generateEmbeddings(text, env);

  // Store in Vectorize
  await env.VECTORIZE.upsert([
    {
      id: memoryId,
      values,
      namespace: userId,
      metadata: { content: text },
    },
  ]);

  return memoryId;
}

/**
 * Search for memories by semantic similarity
 * @param query - The query to search for
 * @param userId - User ID to search within (used as namespace)
 * @param env - Environment containing Vectorize service
 * @returns Promise resolving to an array of memories matching the query
 */
export async function searchMemories(
  query: string,
  userId: string,
  env: Env
): Promise<Array<{ content: string; score: number; id: string }>> {
  // Generate embedding for query
  const queryVector = await generateEmbeddings(query, env);

  // Search Vectorize
  const results = await env.VECTORIZE.query(queryVector, {
    namespace: userId,
    topK: 10,
    returnMetadata: "all",
  });

  if (!results.matches || results.matches.length === 0) {
    return [];
  }

  // Process results
  const memories = results.matches
    .filter((match) => match.score > MINIMUM_SIMILARITY_SCORE)
    .map((match) => {
      // Ensure content is a string
      let content = "Missing memory content";

      if (match.metadata && typeof match.metadata.content === "string") {
        content = match.metadata.content;
      } else if (match.id) {
        content = `Missing memory content (ID: ${match.id})`;
      }

      return {
        content,
        score: match.score || 0,
        id: match.id,
      };
    });

  // Sort by relevance score (highest first)
  memories.sort((a, b) => b.score - a.score);

  return memories;
}

/**
 * Updates a memory vector embedding
 * @param memoryId - ID of the memory to update
 * @param newContent - New content for the memory
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize service
 */
export async function updateMemoryVector(
  memoryId: string,
  newContent: string,
  userId: string,
  env: Env
): Promise<void> {
  // Generate new embedding
  const newValues = await generateEmbeddings(newContent, env);

  // Upsert into Vectorize to update
  await env.VECTORIZE.upsert([
    {
      id: memoryId,
      values: newValues,
      namespace: userId,
      metadata: { content: newContent }, // Update metadata as well
    },
  ]);

  console.log(`Vector for memory ${memoryId} (namespace ${userId}) updated.`);
}

/**
 * Deletes a vector by its ID from the Vectorize index
 * @param memoryId - ID of the memory to delete
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize service
 */
export async function deleteVectorById(memoryId: string, userId: string, env: Env): Promise<void> {
  try {
    // todo WARNING: This might delete the ID globally if namespaces are not implicitly handled.
    // Further investigation needed on how Vectorize handles namespaces during deletion.
    const result = await env.VECTORIZE.deleteByIds([memoryId]);
    console.log(
      `Attempted global deletion for vector ID ${memoryId}. Deletion was requested for user (namespace): ${userId} Result:`,
      result
    );
  } catch (error) {
    console.error(`Error deleting vector ID ${memoryId} from Vectorize namespace ${userId}:`, error);
    throw error;
  }
}
