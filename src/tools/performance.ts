// src/tools/performance.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerPerformanceTools(server: McpServer): void {
  // ─── Fetch Daily Metrics ──────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_daily_metrics",
    {
      title: "Get GBP Daily Performance Metrics",
      description: `Fetch daily performance metrics (views, searches, actions) for a location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - start_date (string): Start date "YYYY-MM-DD" (max 18 months ago)
  - end_date (string): End date "YYYY-MM-DD"
  - metrics (array): Metrics to fetch. Options:
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS" — Desktop Maps views
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH" — Desktop Search views
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS" — Mobile Maps views
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH" — Mobile Search views
      "BUSINESS_CONVERSATIONS" — Messages started
      "BUSINESS_DIRECTION_REQUESTS" — Direction requests
      "CALL_CLICKS" — Phone call clicks
      "WEBSITE_CLICKS" — Website clicks
      "BUSINESS_BOOKINGS" — Bookings
      "BUSINESS_FOOD_ORDERS" — Food orders
      "BUSINESS_FOOD_MENU_CLICKS" — Menu clicks

Returns:
  JSON with multiDailyMetricTimeSeries[] — one series per metric with dailyMetric and timeSeries of { date, value } objects.

Examples:
  - "Show website clicks for last 30 days" -> metrics=["WEBSITE_CLICKS"]
  - "Show all impressions this month"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date "YYYY-MM-DD"'),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date "YYYY-MM-DD"'),
        metrics: z.array(
          z.enum([
            "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
            "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
            "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
            "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
            "BUSINESS_CONVERSATIONS",
            "BUSINESS_DIRECTION_REQUESTS",
            "CALL_CLICKS",
            "WEBSITE_CLICKS",
            "BUSINESS_BOOKINGS",
            "BUSINESS_FOOD_ORDERS",
            "BUSINESS_FOOD_MENU_CLICKS",
          ])
        ).min(1).default(["WEBSITE_CLICKS", "CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS"])
          .describe("Metrics to retrieve"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, start_date, end_date, metrics }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;

      const parseDate = (d: string) => {
        const [year, month, day] = d.split("-").map(Number);
        return { year, month, day };
      };

      const params = new URLSearchParams();
      const sd = parseDate(start_date);
      const ed = parseDate(end_date);
      params.set("dailyRange.start_date.year", String(sd.year));
      params.set("dailyRange.start_date.month", String(sd.month));
      params.set("dailyRange.start_date.day", String(sd.day));
      params.set("dailyRange.end_date.year", String(ed.year));
      params.set("dailyRange.end_date.month", String(ed.month));
      params.set("dailyRange.end_date.day", String(ed.day));
      for (const m of metrics) {
        params.append("dailyMetrics", m);
      }

      const { data } = await client.get(
        `${GBP_ENDPOINTS.performance}/${name}:fetchMultiDailyMetricsTimeSeries?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "performance metrics") }],
        structuredContent: data,
      };
    }
  );

  // ─── Search Keyword Impressions ───────────────────────────────────────────────
  server.registerTool(
    "gbp_get_search_keywords",
    {
      title: "Get GBP Search Keywords",
      description: `Get the top search keywords that triggered impressions for a location (monthly breakdown).

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - year (number): Year e.g. 2026
  - month (number): Month 1–12

Returns:
  JSON with searchKeywordsCounts[] — each with searchKeyword, insightValues (impressionCount per platform — MAPS or SEARCH).

Examples:
  - "What search terms are people using to find Finance Hub?" -> year=2026, month=3
  - "Show top keywords for March 2026"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        year: z.number().int().min(2019).max(2030).describe("Year e.g. 2026"),
        month: z.number().int().min(1).max(12).describe("Month 1–12"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, year, month }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams({
        "monthlyRange.start_month.year": String(year),
        "monthlyRange.start_month.month": String(month),
        "monthlyRange.end_month.year": String(year),
        "monthlyRange.end_month.month": String(month),
      });
      const { data } = await client.get(
        `${GBP_ENDPOINTS.performance}/${name}/searchkeywords/impressions/monthly?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "search keywords") }],
        structuredContent: data,
      };
    }
  );
}

// ─── Q&A Tools ────────────────────────────────────────────────────────────────
export function registerQandATools(server: McpServer): void {
  server.registerTool(
    "gbp_list_questions",
    {
      title: "List GBP Q&A Questions",
      description: `List all questions posted to a location's Q&A section.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - page_size (number): Max questions per page, 1–100 (default: 10)
  - page_token (string): Pagination token
  - answers_per_question (number): Max answers to include per question, 0–10 (default: 3)

Returns:
  JSON with questions[] and nextPageToken.
  Each question: name, author, upvoteCount, text, createTime, updateTime, topAnswers[].`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name'),
        page_size: z.number().int().min(1).max(100).default(10).describe("Questions per page"),
        page_token: z.string().optional().describe("Pagination token"),
        answers_per_question: z.number().int().min(0).max(10).default(3).describe("Answers to return per question"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, page_size, page_token, answers_per_question }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams({
        pageSize: String(page_size),
        answersPerQuestion: String(answers_per_question),
      });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.qanda}/${name}/questions?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "questions list") }],
        structuredContent: data,
      };
    }
  );

  server.registerTool(
    "gbp_answer_question",
    {
      title: "Answer GBP Question",
      description: `Post or update an owner answer to a Q&A question.

Args:
  - question_name (string): Question resource name e.g. "locations/1234567890/questions/question123"
  - answer_text (string): Answer text (max 4096 chars)

Returns:
  Upserted answer object with name, author, text, createTime.`,
      inputSchema: z.object({
        question_name: z.string().describe('Question resource name e.g. "locations/1234567890/questions/question123"'),
        answer_text: z.string().min(1).max(4096).describe("Answer text (max 4096 chars)"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ question_name, answer_text }) => {
      const client = await createGBPClient();
      const { data } = await client.post(
        `${GBP_ENDPOINTS.qanda}/${question_name}/answers:upsert`,
        { answer: { text: answer_text } }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Question ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_question",
    {
      title: "Create GBP Question",
      description: `Post a new question to a location's Q&A section as the merchant.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"
  - text (string): Question text

Returns:
  Created question object with name, author, text, createTime.

Examples:
  - "Post a FAQ question: Do you offer free consultations?"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        text: z.string().min(1).describe("Question text"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, text }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const body = cleanBody({
        text,
        author: { type: "MERCHANT" },
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.qanda}/${name}/questions`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── List Answers ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_answers",
    {
      title: "List GBP Answers",
      description: `List all answers for a specific Q&A question.

Args:
  - parent (string): Question resource name e.g. "locations/1234567890/questions/question123"
  - page_size (number): Max answers per page, 1–100 (default: 10)
  - page_token (string): Pagination token
  - order_by (string): Sort order e.g. "create_time desc" or "upvote_count desc"

Returns:
  JSON with answers[] and nextPageToken.
  Each answer: name, author, text, createTime, updateTime, upvoteCount.

Examples:
  - "Show all answers for question 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Question resource name e.g. "locations/1234567890/questions/question123"'),
        page_size: z.number().int().min(1).max(100).default(10).describe("Answers per page"),
        page_token: z.string().optional().describe("Pagination token"),
        order_by: z.string().optional().describe('Sort order e.g. "create_time desc" or "upvote_count desc"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent, page_size, page_token, order_by }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      if (order_by) params.set("orderBy", order_by);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.qanda}/${parent}/answers?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "answers list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Answer ────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_answer",
    {
      title: "Delete GBP Answer",
      description: `Delete an answer from a Q&A question.

Args:
  - name (string): Answer resource name e.g. "locations/1234567890/questions/question123/answers/answer456"

Returns:
  Empty response on success.

Examples:
  - "Delete answer 456 from question 123"`,
      inputSchema: z.object({
        name: z.string().describe('Answer resource name e.g. "locations/123/questions/q1/answers/a1"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      await client.delete(`${GBP_ENDPOINTS.qanda}/${name}`);
      return {
        content: [{ type: "text", text: "Answer deleted successfully." }],
      };
    }
  );
}
