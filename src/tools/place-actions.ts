// src/tools/place-actions.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerPlaceActionTools(server: McpServer): void {
  // ─── List Place Action Links ──────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_place_actions",
    {
      title: "List Place Action Links",
      description: `List all place action links (booking, ordering, etc.) for a location.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"
  - page_size (number): Max results per page, 1–100 (default: 20)
  - page_token (string): Pagination token from previous response
  - filter (string): Optional filter string

Returns:
  JSON with placeActionLinks[] and nextPageToken.
  Each link: name, placeActionType, uri, providerType, createTime, updateTime.

Examples:
  - "Show all booking links for my location"
  - "List place action links for location 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        page_size: z.number().int().min(1).max(100).default(20).describe("Max results per page"),
        page_token: z.string().optional().describe("Pagination token from previous response"),
        filter: z.string().optional().describe("Optional filter string"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent, page_size, page_token, filter }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      if (filter) params.set("filter", filter);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.placeActions}/${name}/placeActionLinks?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "place action links list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Place Action Link ─────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_place_action",
    {
      title: "Create Place Action Link",
      description: `Create a new place action link (booking URL, ordering URL, etc.) for a location.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"
  - uri (string): The URL for the action link e.g. "https://booking.example.com"
  - place_action_type (string): Type of action — "APPOINTMENT", "ONLINE_APPOINTMENT", "DINING_RESERVATION", "FOOD_ORDERING", "FOOD_DELIVERY", "FOOD_TAKEOUT", "SHOP_ONLINE"

Returns:
  Created place action link object with name, placeActionType, uri, createTime.

Examples:
  - "Add a booking link for my location" -> place_action_type="APPOINTMENT"
  - "Add an online ordering link" -> place_action_type="FOOD_ORDERING"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        uri: z.string().url().describe("URL for the action link"),
        place_action_type: z.enum([
          "APPOINTMENT", "ONLINE_APPOINTMENT", "DINING_RESERVATION",
          "FOOD_ORDERING", "FOOD_DELIVERY", "FOOD_TAKEOUT", "SHOP_ONLINE",
        ]).describe("Type of place action"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, uri, place_action_type }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const body = cleanBody({
        uri,
        placeActionType: place_action_type,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.placeActions}/${name}/placeActionLinks`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Update Place Action Link ─────────────────────────────────────────────────
  server.registerTool(
    "gbp_update_place_action",
    {
      title: "Update Place Action Link",
      description: `Update an existing place action link (change URL or type).

Args:
  - name (string): Place action link resource name e.g. "locations/1234567890/placeActionLinks/abc123"
  - update_mask (string): Comma-separated fields to update e.g. "uri,placeActionType"
  - uri (string): New URL for the action link
  - place_action_type (string): New action type

Returns:
  Updated place action link object.

Examples:
  - "Update the booking URL for action link abc123"`,
      inputSchema: z.object({
        name: z.string().describe('Place action link resource name e.g. "locations/123/placeActionLinks/abc"'),
        update_mask: z.string().describe('Comma-separated fields to update e.g. "uri,placeActionType"'),
        uri: z.string().url().optional().describe("New URL for the action link"),
        place_action_type: z.enum([
          "APPOINTMENT", "ONLINE_APPOINTMENT", "DINING_RESERVATION",
          "FOOD_ORDERING", "FOOD_DELIVERY", "FOOD_TAKEOUT", "SHOP_ONLINE",
        ]).optional().describe("New action type"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, update_mask, uri, place_action_type }) => {
      const client = await createGBPClient();
      const body = cleanBody({
        uri,
        placeActionType: place_action_type,
      });
      const { data } = await client.patch(
        `${GBP_ENDPOINTS.placeActions}/${name}?updateMask=${update_mask}`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Place Action Link ─────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_place_action",
    {
      title: "Delete Place Action Link",
      description: `Delete a place action link from a location.

Args:
  - name (string): Place action link resource name e.g. "locations/1234567890/placeActionLinks/abc123"

Returns:
  Empty response on success.

Examples:
  - "Remove the booking link abc123 from my location"`,
      inputSchema: z.object({
        name: z.string().describe('Place action link resource name e.g. "locations/123/placeActionLinks/abc"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.placeActions}/${name}`);
      return {
        content: [{ type: "text", text: "Place action link deleted successfully." }],
      };
    }
  );
}
