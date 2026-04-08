// src/tools/posts.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerPostTools(server: McpServer): void {
  // ─── List Posts ───────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_posts",
    {
      title: "List GBP Posts",
      description: `List Google Business Profile posts (What's New, Events, Offers) for a location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - page_size (number): Max posts per page, 1–100 (default: 20)
  - page_token (string): Pagination token

Returns:
  JSON with localPosts[] and nextPageToken.
  Each post: name, languageCode, summary, callToAction, createTime, updateTime, state (LIVE/REJECTED), topicType (STANDARD/EVENT/OFFER/ALERT).

Examples:
  - "Show all current posts for my location"
  - "List offer posts"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890123456789"'),
        page_size: z.number().int().min(1).max(100).default(20).describe("Posts per page"),
        page_token: z.string().optional().describe("Pagination token"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, page_size, page_token }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.mybusiness}/${name}/localPosts?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "posts list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Post ──────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_post",
    {
      title: "Create GBP Post",
      description: `Create a new Google Business Profile post for a location.

Args:
  - location_name (string): Location resource name
  - topic_type (string): Post type — "STANDARD" (What's New), "EVENT", "OFFER", "ALERT"
  - summary (string): Post body text (max 1500 chars)
  - language_code (string): Language e.g. "en-AU" (default)
  - cta_type (string): Call-to-action — "BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL", "GET_OFFER"
  - cta_url (string): URL for the CTA button
  - event_title (string): [EVENT/OFFER only] Title for the event or offer
  - event_start_date (string): [EVENT/OFFER only] Start date "YYYY-MM-DD"
  - event_end_date (string): [EVENT/OFFER only] End date "YYYY-MM-DD"
  - offer_coupon_code (string): [OFFER only] Coupon/promo code

Returns:
  Created post object with name, state, createTime.

Examples:
  - "Create a What's New post about rate changes" -> topic_type="STANDARD"
  - "Create an offer post for first home buyers" -> topic_type="OFFER"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        topic_type: z.enum(["STANDARD", "EVENT", "OFFER", "ALERT"])
          .default("STANDARD")
          .describe("Post type"),
        summary: z.string().min(1).max(1500).describe("Post body text (max 1500 chars)"),
        language_code: z.string().default("en-AU").describe('Language code e.g. "en-AU"'),
        cta_type: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL", "GET_OFFER"])
          .optional()
          .describe("Call-to-action button type"),
        cta_url: z.string().url().optional().describe("URL for the CTA button"),
        event_title: z.string().optional().describe("[EVENT/OFFER] Title"),
        event_start_date: z.string().optional().describe('[EVENT/OFFER] Start date "YYYY-MM-DD"'),
        event_end_date: z.string().optional().describe('[EVENT/OFFER] End date "YYYY-MM-DD"'),
        offer_coupon_code: z.string().optional().describe("[OFFER] Coupon code"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ location_name, topic_type, summary, language_code, cta_type, cta_url, event_title, event_start_date, event_end_date, offer_coupon_code }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;

      const parseDate = (d: string) => {
        const [year, month, day] = d.split("-").map(Number);
        return { year, month, day };
      };

      const body = cleanBody({
        languageCode: language_code,
        summary,
        topicType: topic_type,
        callToAction: cta_type ? cleanBody({ actionType: cta_type, url: cta_url }) : undefined,
        event: (event_title || event_start_date) ? cleanBody({
          title: event_title,
          schedule: (event_start_date && event_end_date) ? {
            startDate: parseDate(event_start_date),
            endDate: parseDate(event_end_date),
          } : undefined,
        }) : undefined,
        offer: offer_coupon_code ? { couponCode: offer_coupon_code } : undefined,
      });

      const { data } = await client.post(
        `${GBP_ENDPOINTS.mybusiness}/${name}/localPosts`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Post ────────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_post",
    {
      title: "Get GBP Post",
      description: `Get details for a specific Google Business Profile post.

Args:
  - post_name (string): Full post resource name e.g. "locations/1234567890/localPosts/abcdef123"

Returns:
  JSON with post details: name, languageCode, summary, callToAction, createTime, updateTime, state, topicType, event, offer, media.

Examples:
  - "Get details for post abcdef123"
  - "Show me post content for locations/123/localPosts/abc"`,
      inputSchema: z.object({
        post_name: z.string().describe('Post resource name e.g. "locations/1234567890/localPosts/abcdef123"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ post_name }) => {
      const client = await createGBPClient();
      const { data } = await client.get(`${GBP_ENDPOINTS.mybusiness}/${post_name}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Update Post ──────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_update_post",
    {
      title: "Update GBP Post",
      description: `Update an existing Google Business Profile post.

Args:
  - post_name (string): Full post resource name e.g. "locations/1234567890/localPosts/abcdef123"
  - update_mask (string): Comma-separated fields to update e.g. "summary,callToAction"
  - summary (string): Updated post body text (max 1500 chars)
  - language_code (string): Updated language code
  - cta_type (string): Updated CTA button type
  - cta_url (string): Updated CTA URL
  - event_title (string): Updated event title
  - event_start_date (string): Updated start date "YYYY-MM-DD"
  - event_end_date (string): Updated end date "YYYY-MM-DD"

Returns:
  Updated post object.

Examples:
  - "Update the summary of post abc123" -> update_mask="summary"`,
      inputSchema: z.object({
        post_name: z.string().describe('Post resource name e.g. "locations/1234567890/localPosts/abcdef123"'),
        update_mask: z.string().describe('Comma-separated fields to update e.g. "summary,callToAction"'),
        summary: z.string().max(1500).optional().describe("Updated post body text"),
        language_code: z.string().optional().describe("Updated language code"),
        cta_type: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL", "GET_OFFER"])
          .optional().describe("Updated CTA button type"),
        cta_url: z.string().url().optional().describe("Updated CTA URL"),
        event_title: z.string().optional().describe("Updated event title"),
        event_start_date: z.string().optional().describe('Updated start date "YYYY-MM-DD"'),
        event_end_date: z.string().optional().describe('Updated end date "YYYY-MM-DD"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ post_name, update_mask, summary, language_code, cta_type, cta_url, event_title, event_start_date, event_end_date }) => {
      const client = await createGBPClient();

      const parseDate = (d: string) => {
        const [year, month, day] = d.split("-").map(Number);
        return { year, month, day };
      };

      const body = cleanBody({
        summary,
        languageCode: language_code,
        callToAction: cta_type ? cleanBody({ actionType: cta_type, url: cta_url }) : undefined,
        event: (event_title || event_start_date) ? cleanBody({
          title: event_title,
          schedule: (event_start_date && event_end_date) ? {
            startDate: parseDate(event_start_date),
            endDate: parseDate(event_end_date),
          } : undefined,
        }) : undefined,
      });

      const { data } = await client.patch(
        `${GBP_ENDPOINTS.mybusiness}/${post_name}?updateMask=${update_mask}`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Post ──────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_post",
    {
      title: "Delete GBP Post",
      description: `Delete a Google Business Profile post.

Args:
  - post_name (string): Full post resource name e.g. "locations/1234567890/localPosts/abcdef123"

Returns:
  Empty response on success.`,
      inputSchema: z.object({
        post_name: z.string().describe('Post resource name e.g. "locations/1234567890/localPosts/abcdef123"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ post_name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.mybusiness}/${post_name}`);
      return {
        content: [{ type: "text", text: "Post deleted successfully." }],
      };
    }
  );
}
