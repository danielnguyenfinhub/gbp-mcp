// src/tools/reviews.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
} from "../services/gbp-client.js";

export function registerReviewTools(server: McpServer): void {
  // ─── List Reviews ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_reviews",
    {
      title: "List GBP Reviews",
      description: `List customer reviews for a Google Business Profile location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - page_size (number): Max reviews per page, 1–50 (default: 50)
  - page_token (string): Pagination token from previous response
  - order_by (string): Sort order — "updateTime desc" (default, newest first) or "rating desc"

Returns:
  JSON with reviews[] array, nextPageToken, and averageRating.
  Each review: reviewId, reviewer (displayName, isAnonymous), starRating (ONE–FIVE), comment, createTime, updateTime, reviewReply.

Examples:
  - "Show all reviews for my location" -> location_name="locations/123"
  - "Get unanswered reviews" -> filter reviews where reviewReply is absent
  - "Show 1-star reviews" -> order_by="rating asc"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890123456789"'),
        page_size: z.number().int().min(1).max(50).default(50).describe("Reviews per page"),
        page_token: z.string().optional().describe("Pagination token"),
        order_by: z.enum(["updateTime desc", "rating desc", "rating asc", "updateTime asc"])
          .default("updateTime desc")
          .describe("Sort order"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, page_size, page_token, order_by }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams({
        pageSize: String(page_size),
        orderBy: order_by,
      });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.mybusiness}/${name}/reviews?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "reviews list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Review ───────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_review",
    {
      title: "Get GBP Review",
      description: `Get a specific review by its resource name.

Args:
  - review_name (string): Full review resource name e.g. "locations/1234567890/reviews/AbCdEf"

Returns:
  Full review object including reviewer, starRating, comment, createTime, reviewReply.`,
      inputSchema: z.object({
        review_name: z.string().describe('Review resource name e.g. "locations/1234567890/reviews/AbCdEf"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ review_name }) => {
      const client = await createGBPClient();
      const { data } = await client.get(`${GBP_ENDPOINTS.mybusiness}/${review_name}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Reply to Review ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_reply_to_review",
    {
      title: "Reply to GBP Review",
      description: `Post or update the owner's reply to a customer review.

Args:
  - review_name (string): Full review resource name e.g. "locations/1234567890/reviews/AbCdEf"
  - reply_text (string): Reply text (max 4096 chars). Should be professional and ASIC-safe for Finance Hub.

Returns:
  Updated reviewReply object with comment and updateTime.

Note: Calling this on an existing reply will overwrite it.
Examples:
  - "Reply to a 5-star review thanking the client"
  - "Respond to a 1-star review professionally"`,
      inputSchema: z.object({
        review_name: z.string().describe('Review resource name e.g. "locations/1234567890/reviews/AbCdEf"'),
        reply_text: z.string().min(1).max(4096).describe("Reply text (max 4096 characters)"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ review_name, reply_text }) => {
      const client = await createGBPClient();
      const { data } = await client.put(
        `${GBP_ENDPOINTS.mybusiness}/${review_name}/reply`,
        { comment: reply_text }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Review Reply ──────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_review_reply",
    {
      title: "Delete GBP Review Reply",
      description: `Delete the owner's reply to a specific review.

Args:
  - review_name (string): Full review resource name e.g. "locations/1234567890/reviews/AbCdEf"

Returns:
  Empty response on success.`,
      inputSchema: z.object({
        review_name: z.string().describe('Review resource name e.g. "locations/1234567890/reviews/AbCdEf"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ review_name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.mybusiness}/${review_name}/reply`);
      return {
        content: [{ type: "text", text: "Review reply deleted successfully." }],
      };
    }
  );
}
