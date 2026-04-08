// src/tools/admins.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

const ADMIN_ROLES = ["PRIMARY_OWNER", "OWNER", "MANAGER", "SITE_MANAGER"] as const;

export function registerAdminTools(server: McpServer): void {
  // ─── List Account Admins ──────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_account_admins",
    {
      title: "List Account Admins",
      description: `List all admins for a Google Business Profile account.

Args:
  - parent (string): Account resource name e.g. "accounts/123456789"

Returns:
  JSON with admins[] array.
  Each admin: name (resource path), admin (email), role (PRIMARY_OWNER/OWNER/MANAGER/SITE_MANAGER), pendingInvitation.

Examples:
  - "Who are the admins on my GBP account?"
  - "List all managers for account 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Account resource name e.g. "accounts/123456789"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("accounts/") ? parent : `accounts/${parent}`;
      const { data } = await client.get(
        `${GBP_ENDPOINTS.accountManagement}/${name}/admins`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "account admins list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Account Admin ─────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_account_admin",
    {
      title: "Create Account Admin",
      description: `Add a new admin to a Google Business Profile account by email.

Args:
  - parent (string): Account resource name e.g. "accounts/123456789"
  - admin (string): Email address of the person to add
  - role (string): Admin role — "PRIMARY_OWNER", "OWNER", "MANAGER", "SITE_MANAGER"

Returns:
  Created admin object with name, admin (email), role, pendingInvitation.

Examples:
  - "Add john@example.com as a manager on account 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Account resource name e.g. "accounts/123456789"'),
        admin: z.string().email().describe("Email address of the person to add"),
        role: z.enum(ADMIN_ROLES).describe("Admin role: PRIMARY_OWNER, OWNER, MANAGER, or SITE_MANAGER"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, admin, role }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("accounts/") ? parent : `accounts/${parent}`;
      const body = cleanBody({ admin, role });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.accountManagement}/${name}/admins`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Account Admin ─────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_account_admin",
    {
      title: "Delete Account Admin",
      description: `Remove an admin from a Google Business Profile account.

Args:
  - name (string): Admin resource name e.g. "accounts/123456789/admins/987654321"

Returns:
  Empty response on success.

Examples:
  - "Remove admin 987654321 from account 123"`,
      inputSchema: z.object({
        name: z.string().describe('Admin resource name e.g. "accounts/123/admins/987"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.accountManagement}/${name}`);
      return {
        content: [{ type: "text", text: "Account admin removed successfully." }],
      };
    }
  );

  // ─── List Location Admins ─────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_location_admins",
    {
      title: "List Location Admins",
      description: `List all admins for a specific location.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"

Returns:
  JSON with admins[] array.
  Each admin: name (resource path), admin (email), role (PRIMARY_OWNER/OWNER/MANAGER/SITE_MANAGER), pendingInvitation.

Examples:
  - "Who manages this location?"
  - "List admins for location 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const { data } = await client.get(
        `${GBP_ENDPOINTS.accountManagement}/${name}/admins`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "location admins list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Location Admin ────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_location_admin",
    {
      title: "Create Location Admin",
      description: `Add a new admin to a specific location by email.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"
  - admin (string): Email address of the person to add
  - role (string): Admin role — "PRIMARY_OWNER", "OWNER", "MANAGER", "SITE_MANAGER"

Returns:
  Created admin object with name, admin (email), role, pendingInvitation.

Examples:
  - "Add jane@example.com as a site manager for location 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        admin: z.string().email().describe("Email address of the person to add"),
        role: z.enum(ADMIN_ROLES).describe("Admin role: PRIMARY_OWNER, OWNER, MANAGER, or SITE_MANAGER"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, admin, role }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const body = cleanBody({ admin, role });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.accountManagement}/${name}/admins`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Location Admin ────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_location_admin",
    {
      title: "Delete Location Admin",
      description: `Remove an admin from a specific location.

Args:
  - name (string): Location admin resource name e.g. "locations/1234567890/admins/987654321"

Returns:
  Empty response on success.

Examples:
  - "Remove admin 987 from location 123"`,
      inputSchema: z.object({
        name: z.string().describe('Location admin resource name e.g. "locations/123/admins/987"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.accountManagement}/${name}`);
      return {
        content: [{ type: "text", text: "Location admin removed successfully." }],
      };
    }
  );
}
