// src/tools/media.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerMediaTools(server: McpServer): void {
  // ─── List Media ───────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_media",
    {
      title: "List GBP Media",
      description: `List all media items (photos and videos) for a location.

Args:
  - parent (string): Location resource name e.g. "accounts/123/locations/456" or "locations/456"
  - page_size (number): Max media items per page, 1–100 (default: 20)
  - page_token (string): Pagination token from previous response

Returns:
  JSON with mediaItems[] and nextPageToken.
  Each media item: name, mediaFormat (PHOTO/VIDEO), sourceUrl, description, locationAssociation, createTime.

Examples:
  - "Show all photos for my location"
  - "List media items for location 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "accounts/123/locations/456"'),
        page_size: z.number().int().min(1).max(100).default(20).describe("Max media items per page"),
        page_token: z.string().optional().describe("Pagination token from previous response"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent, page_size, page_token }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.mybusiness}/${parent}/media?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "media list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Media ────────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_media",
    {
      title: "Get GBP Media Item",
      description: `Get details for a specific media item (photo or video).

Args:
  - name (string): Media item resource name e.g. "accounts/123/locations/456/media/789"

Returns:
  JSON with media item details: name, mediaFormat, sourceUrl, description, locationAssociation, createTime, sizeBytes, dimensions.

Examples:
  - "Get details for media item 789"`,
      inputSchema: z.object({
        name: z.string().describe('Media item resource name e.g. "accounts/123/locations/456/media/789"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      const { data } = await client.get(`${GBP_ENDPOINTS.mybusiness}/${name}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Media ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_media",
    {
      title: "Create GBP Media Item",
      description: `Upload a new photo or video to a location by providing a public URL.

Args:
  - parent (string): Location resource name e.g. "accounts/123/locations/456"
  - media_format (string): Media type — "PHOTO" or "VIDEO"
  - source_url (string): Publicly accessible URL where the media can be retrieved
  - description (string): Optional description for the media item
  - category (string): Optional location association category — "COVER", "PROFILE", "LOGO", "EXTERIOR", "INTERIOR", "PRODUCT", "AT_WORK", "FOOD_AND_DRINK", "MENU", "COMMON_AREA", "ROOMS", "TEAMS", "ADDITIONAL"

Returns:
  Created media item object with name, mediaFormat, sourceUrl, createTime.

Examples:
  - "Upload a new exterior photo for my location"
  - "Set a new cover photo from URL https://example.com/photo.jpg"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "accounts/123/locations/456"'),
        media_format: z.enum(["PHOTO", "VIDEO"]).default("PHOTO").describe("Media type: PHOTO or VIDEO"),
        source_url: z.string().url().describe("Publicly accessible URL for the media"),
        description: z.string().optional().describe("Description for the media item"),
        category: z.enum([
          "COVER", "PROFILE", "LOGO", "EXTERIOR", "INTERIOR", "PRODUCT",
          "AT_WORK", "FOOD_AND_DRINK", "MENU", "COMMON_AREA", "ROOMS", "TEAMS", "ADDITIONAL",
        ]).optional().describe("Location association category e.g. COVER, PROFILE, EXTERIOR"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, media_format, source_url, description, category }) => {
      const client = await createGBPClient();
      const body = cleanBody({
        mediaFormat: media_format,
        sourceUrl: source_url,
        description,
        locationAssociation: category ? { category } : undefined,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.mybusiness}/${parent}/media`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Media ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_media",
    {
      title: "Delete GBP Media Item",
      description: `Delete a media item (photo or video) from a location.

Args:
  - name (string): Media item resource name e.g. "accounts/123/locations/456/media/789"

Returns:
  Empty response on success.

Examples:
  - "Delete photo 789 from my location"`,
      inputSchema: z.object({
        name: z.string().describe('Media item resource name e.g. "accounts/123/locations/456/media/789"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.mybusiness}/${name}`);
      return {
        content: [{ type: "text", text: "Media item deleted successfully." }],
      };
    }
  );
}
