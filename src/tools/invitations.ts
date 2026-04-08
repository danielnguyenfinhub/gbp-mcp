// src/tools/invitations.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
} from "../services/gbp-client.js";

export function registerInvitationTools(server: McpServer): void {
  // ─── List Invitations ─────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_invitations",
    {
      title: "List GBP Invitations",
      description: `List pending invitations for a Google Business Profile account.

Args:
  - parent (string): Account resource name e.g. "accounts/123456789"
  - filter (string): Optional filter string e.g. "target_type=ACCOUNT_ONLY"

Returns:
  JSON with invitations[] array.
  Each invitation: name (resource path), targetAccount, targetLocation, role, state.

Examples:
  - "Show pending invitations for my account"
  - "Do I have any GBP invitations?"`,
      inputSchema: z.object({
        parent: z.string().describe('Account resource name e.g. "accounts/123456789"'),
        filter: z.string().optional().describe("Optional filter string"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent, filter }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("accounts/") ? parent : `accounts/${parent}`;
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      const url = params.size
        ? `${GBP_ENDPOINTS.accountManagement}/${name}/invitations?${params}`
        : `${GBP_ENDPOINTS.accountManagement}/${name}/invitations`;
      const { data } = await client.get(url);
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "invitations list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Accept Invitation ────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_accept_invitation",
    {
      title: "Accept GBP Invitation",
      description: `Accept a pending Google Business Profile invitation.

Args:
  - name (string): Invitation resource name e.g. "accounts/123456789/invitations/abc123"

Returns:
  Empty response on success.

Examples:
  - "Accept the pending invitation abc123"`,
      inputSchema: z.object({
        name: z.string().describe('Invitation resource name e.g. "accounts/123/invitations/abc123"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.post(`${GBP_ENDPOINTS.accountManagement}/${name}:accept`, {});
      return {
        content: [{ type: "text", text: "Invitation accepted successfully." }],
      };
    }
  );

  // ─── Decline Invitation ───────────────────────────────────────────────────────
  server.registerTool(
    "gbp_decline_invitation",
    {
      title: "Decline GBP Invitation",
      description: `Decline a pending Google Business Profile invitation.

Args:
  - name (string): Invitation resource name e.g. "accounts/123456789/invitations/abc123"

Returns:
  Empty response on success.

Examples:
  - "Decline the pending invitation abc123"`,
      inputSchema: z.object({
        name: z.string().describe('Invitation resource name e.g. "accounts/123/invitations/abc123"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.post(`${GBP_ENDPOINTS.accountManagement}/${name}:decline`, {});
      return {
        content: [{ type: "text", text: "Invitation declined successfully." }],
      };
    }
  );
}
