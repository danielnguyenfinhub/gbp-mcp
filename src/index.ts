// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

import { registerAccountTools } from "./tools/accounts.js";
import { registerReviewTools } from "./tools/reviews.js";
import { registerPostTools } from "./tools/posts.js";
import { registerPerformanceTools, registerQandATools } from "./tools/performance.js";
import { registerAttributeTools } from "./tools/attributes.js";
import { registerMediaTools } from "./tools/media.js";
import { registerPlaceActionTools } from "./tools/place-actions.js";
import { registerAdminTools } from "./tools/admins.js";
import { registerInvitationTools } from "./tools/invitations.js";
import { registerVerificationTools } from "./tools/verifications.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { warmTokenCache } from "./services/token-manager.js";

// ─── Server Initialisation ────────────────────────────────────────────────────
const server = new McpServer({
  name: "gbp-mcp-server",
  version: "2.0.0",
});

// ─── Register All Tool Groups ─────────────────────────────────────────────────
registerAccountTools(server);      // Accounts, Locations CRUD
registerReviewTools(server);       // Reviews + reply management
registerPostTools(server);         // Posts (What's New, Events, Offers)
registerPerformanceTools(server);  // Daily metrics, search keywords
registerQandATools(server);        // Q&A questions and answers
registerAttributeTools(server);    // Attributes and Categories
registerMediaTools(server);        // Media (photos, videos)
registerPlaceActionTools(server);  // Place action links (booking, ordering)
registerAdminTools(server);        // Account and location admins
registerInvitationTools(server);   // Account invitations
registerVerificationTools(server); // Location verifications
registerNotificationTools(server); // Notification settings

// ─── Transport Selection ──────────────────────────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "gbp-mcp-server", version: "2.0.0", tools: 52 });
  });

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.error(`GBP MCP server running on http://localhost:${port}/mcp`);
    void warmTokenCache(); // Pre-fetch access token on startup
  });
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GBP MCP server running on stdio");
}

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
