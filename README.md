<div align="center" >🤝 Show your support - give a ⭐️ if you liked the content
</div>

---

# MCP Memory

**MCP Memory** is a **MCP Server** that gives **MCP Clients (Cursor, Claude, Windsurf and more)** the **ability to remember** information about users (preferences, behaviors) **across conversations**. It uses vector search technology to find relevant memories based on meaning, not just keywords. It's built with Cloudflare Workers, D1, Vectorize (RAG), Durable Objects, Workers AI and Agents.

## 📺 Video

<a href="https://www.youtube.com/watch?feature=player_embedded&v=qfFvYERw2TQ" target="_blank">
 <img src="https://github.com/Puliczek/mcp-memory/blob/main/video.png?raw=true" alt="Watch the video" width="800" height="450" border="10" />
</a>

## 🚀 Try It Out


### [https://memory.mcpgenerator.com/](https://memory.mcpgenerator.com/)



## 🛠️ How to Deploy Your Own MCP Memory

### Option 1: One-Click Deploy Your Own MCP Memory to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/puliczek/mcp-memory)

In **Create Vectorize** section choose:
- **Dimensions:** 1024
- **Metric:** cosine

Click button **"Create and Deploy"**

In Cloudflare dashboard, go to "Workers & Pages" and click on Visit

![Visit MCP Memory](/visit.png)


### Option 2: Use this template
1. Click the "Use this template" button at the top of this repository
2. Clone your new repository
3. Follow the setup instructions below

### Option 3: Create with CloudFlare CLI

```bash
npm create cloudflare@latest --git https://github.com/puliczek/mcp-memory
```

## 🔧 Setup (Only Option 2 & 3)

1. Install dependencies:
```bash
npm install
```

2. Create a Vectorize index:
```bash
npx wrangler vectorize create mcp-memory-vectorize --dimensions 1024 --metric cosine
```

3. Install Wrangler:
```bash
npm run dev
```

4. Deploy the worker:
```bash
npm run deploy
```

## 🧠 How It Works

![MCP Memory Architecture](/arch.png)


1. **Storing Memories**:
   - Your text is processed by **Cloudflare Workers AI** using the open-source `@cf/baai/bge-m3` model to generate embeddings
   - The text and its vector embedding are stored in two places:
     - **Cloudflare Vectorize**: Stores the vector embeddings for similarity search
     - **Cloudflare D1**: Stores the original text and metadata for persistence
   - A **Durable Object** (MyMCP) manages the state and ensures consistency
   - The **Agents** framework handles the **MCP protocol** communication

2. **Retrieving Memories**:
   - Your query is converted to a vector using **Workers AI** with the same `@cf/baai/bge-m3` model
   - Vectorize performs similarity search to find relevant memories
   - Results are ranked by similarity score
   - The **D1 database** provides the original text for matched vectors
   - The **Durable Object** coordinates the retrieval process

This architecture enables:
- Fast vector similarity search through Vectorize
- Persistent storage with D1
- Stateful operations via Durable Objects
- Standardized AI interactions through Workers AI
- Protocol compliance via the Agents framework

The system finds conceptually related information even when the exact words don't match.

## 🔒 Security

MCP Memory implements several security measures to protect user data:

- Each user's memories are stored in **isolated namespaces** within Vectorize for data separation
- Built-in **rate limiting** prevents abuse (**100 req/min** - you can change it in wrangler.jsonc)
- **Authentication is based on userId only**
  - While this is sufficient for basic protection due to rate limiting
  - Additional authentication layers (like API keys or OAuth) can be easily added if needed
- All data is stored in Cloudflare's secure infrastructure
- All communications are secured with industry-standard TLS encryption (automatically provided by Cloudflare's SSL/TLS certification)



## 💰 Cost Information - FREE for Most Users

MCP Memory is free to use for normal usage levels:
- Free tier allows 1,000 memories with ~28,000 queries per month
- Uses Cloudflare's free quota for Workers, Vectorize, Worker AI and D1 database

For more details on Cloudflare pricing, see:
- [Vectorize Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/pricing-and-rate-limits/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Database D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

## ❓ FAQ

1. **Can I use memory.mcpgenerator.com to store my memories?**
   - Yes, you can use memory.mcpgenerator.com to store and retrieve your memories
   - The service is free
   - Your memories are securely stored and accessible only to you
   - I cannot guarantee that the service will always be available

2. **Can I host it?**
   - Yes, you can host your own instance of MCP Memory **for free on Cloudflare**
   - You'll need a Cloudflare account and the following services:
     - Workers
     - Vectorize
     - D1 Database
     - Workers AI

3. **Can I run it locally?**
   - Yes, you can run MCP Memory locally for development
   - Use `wrangler dev` to run the worker locally
   - You'll need to set up local development credentials for Cloudflare services
   - Note that some features like vector search or workers AI requires a connection to Cloudflare's services

4. **Can I use different hosting?**
   - No, MCP Memory is specifically designed for Cloudflare's infrastructure

5. **Why did you build it?**
   - I wanted an open-source solution
   - Control over my own data was important to me


6. **Can I use it for more than one person?**
   - Yes, MCP Memory can be integrated into your app to serve all your users
   - Each user gets their own isolated memory space

7. **Can I use it to store things other than memories?**
   - Yes, MCP Memory can store any type of text-based information
   - Some practical examples:
     - Knowledge Base: Store technical documentation, procedures, and troubleshooting guides
     - User Behaviors: Track how users interact with features and common usage patterns
     - Project Notes: decisions and project updates
   - The vector search will help find related items regardless of content type



# 🤝 Show your support

<div>🤝 Show your support - give a ⭐️ if you liked the content</div>
