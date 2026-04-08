// src/tools/attributes.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerAttributeTools(server: McpServer): void {
  // ─── List Available Attributes ────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_attributes",
    {
      title: "List Available GBP Attributes",
      description: `List all attributes available for a location based on its category and region.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789" (used for context)
  - category_name (string): Category resource name e.g. "categories/gcid:mortgage_broker"
  - region_code (string): ISO 3166-1 alpha-2 region code e.g. "AU"
  - language_code (string): Language code e.g. "en" (default)
  - page_size (number): Max attributes per page (default: 100)
  - show_all (boolean): If true, shows ALL attributes regardless of location's current settings

Returns:
  JSON with attributes[] — each with attributeId, valueType, displayName, groupDisplayName, isRepeatable, isDeprecated.

Examples:
  - "What attributes can I set for a mortgage broker in Australia?"`,
      inputSchema: z.object({
        location_name: z.string().optional().describe('Location resource name (for context)'),
        category_name: z.string().optional().describe('Category e.g. "categories/gcid:mortgage_broker"'),
        region_code: z.string().default("AU").describe("ISO 3166-1 alpha-2 region code"),
        language_code: z.string().default("en").describe("Language code"),
        page_size: z.number().int().min(1).max(200).default(100).describe("Max attributes per page"),
        show_all: z.boolean().default(false).describe("Show all attributes including those not currently set"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, category_name, region_code, language_code, page_size, show_all }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({
        regionCode: region_code,
        languageCode: language_code,
        pageSize: String(page_size),
      });
      if (location_name) params.set("parent", location_name.startsWith("locations/") ? location_name : `locations/${location_name}`);
      if (category_name) params.set("categoryName", category_name);
      if (show_all) params.set("showAll", "true");

      const { data } = await client.get(
        `${GBP_ENDPOINTS.businessInformation}/attributes?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "attributes list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Location Attributes ──────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_location_attributes",
    {
      title: "Get Location Attributes",
      description: `Get all attributes currently set on a specific location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"

Returns:
  JSON with attributes[] — each with name (attribute resource), values[], repeatedEnumValue, urlValues[].`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const { data } = await client.get(
        `${GBP_ENDPOINTS.businessInformation}/${name}/attributes`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Update Location Attributes ───────────────────────────────────────────────
  server.registerTool(
    "gbp_update_location_attributes",
    {
      title: "Update Location Attributes",
      description: `Update one or more attributes on a location (e.g. accessibility, amenities, payment methods).

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - attributes (array): Array of attribute objects to set. Each must have:
      - name: Attribute resource name e.g. "locations/1234567890/attributes/has_wheelchair_accessible_entrance"
      - values: Array of values (boolean true/false, string, number depending on valueType)
  - attribute_mask (string): Comma-separated attribute names being updated (for partial update)

Returns:
  Updated attributes object.

Examples:
  - Set wheelchair accessible: attributes=[{name: "locations/X/attributes/has_wheelchair_accessible_entrance", values: [true]}]`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name'),
        attributes: z.array(z.object({
          name: z.string().describe("Attribute resource name"),
          values: z.array(z.unknown()).describe("Attribute values"),
        })).min(1).describe("Attributes to update"),
        attribute_mask: z.string().optional().describe("Comma-separated attribute names for partial update"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, attributes, attribute_mask }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams();
      if (attribute_mask) params.set("attributeMask", attribute_mask);
      const url = `${GBP_ENDPOINTS.businessInformation}/${name}/attributes${params.size ? `?${params}` : ""}`;
      const { data } = await client.patch(url, { attributes });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── List Categories ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_categories",
    {
      title: "List GBP Business Categories",
      description: `Search for valid Google Business Profile categories by keyword.

Args:
  - region_code (string): ISO 3166-1 alpha-2 code e.g. "AU" (default)
  - language_code (string): Language code e.g. "en" (default)
  - filter (string): Text filter to search categories e.g. "mortgage" or "finance"
  - page_size (number): Max results, 1–100 (default: 20)
  - view (string): "BASIC" (name only) or "FULL" (with service types and more)

Returns:
  JSON with categories[] — each with name (resource name like "gcid:mortgage_broker"), displayName.

Examples:
  - "Find GBP category for mortgage brokers" -> filter="mortgage"
  - "What finance-related categories exist?" -> filter="finance"`,
      inputSchema: z.object({
        region_code: z.string().default("AU").describe("Region code e.g. AU"),
        language_code: z.string().default("en").describe("Language code e.g. en"),
        filter: z.string().optional().describe("Text search filter e.g. 'mortgage'"),
        page_size: z.number().int().min(1).max(100).default(20).describe("Max results"),
        view: z.enum(["BASIC", "FULL"]).default("BASIC").describe("Level of detail"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ region_code, language_code, filter, page_size, view }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({
        regionCode: region_code,
        languageCode: language_code,
        pageSize: String(page_size),
        view,
      });
      if (filter) params.set("filter", filter);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.businessInformation}/categories?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "categories list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Batch Get Categories ───────────────────────────────────────────────────
  server.registerTool(
    "gbp_batch_get_categories",
    {
      title: "Batch Get GBP Categories",
      description: `Get details for multiple categories at once by their resource names.

Args:
  - names (array): Array of category resource names e.g. ["gcid:mortgage_broker", "gcid:financial_planner"]
  - region_code (string): ISO 3166-1 alpha-2 code e.g. "AU" (default)
  - language_code (string): Language code e.g. "en" (default)

Returns:
  JSON with categories[] — each with name, displayName, serviceTypes[], moreHoursTypes[].

Examples:
  - "Get details for mortgage_broker and financial_planner categories"`,
      inputSchema: z.object({
        names: z.array(z.string()).min(1).describe('Category resource names e.g. ["gcid:mortgage_broker"]'),
        region_code: z.string().default("AU").describe("Region code e.g. AU"),
        language_code: z.string().default("en").describe("Language code e.g. en"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ names, region_code, language_code }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({
        regionCode: region_code,
        languageCode: language_code,
      });
      for (const n of names) {
        params.append("names", n);
      }
      const { data } = await client.get(
        `${GBP_ENDPOINTS.businessInformation}/categories:batchGet?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "batch categories") }],
        structuredContent: data,
      };
    }
  );

  // ─── Search Google Locations ──────────────────────────────────────────────────
  server.registerTool(
    "gbp_search_google_locations",
    {
      title: "Search Google Locations",
      description: `Search for Google locations (businesses/places) by query string. Useful for finding existing businesses to claim or for competitive research.

Args:
  - query (string): Search query e.g. "Finance Hub Sydney" or "mortgage broker Parramatta"
  - page_size (number): Max results, 1–10 (default: 10)

Returns:
  JSON with googleLocations[] — each with name, location (address, phone, etc.), requestAdminRightsUri.

Examples:
  - "Search for Finance Hub in Sydney"
  - "Find mortgage brokers near Parramatta"`,
      inputSchema: z.object({
        query: z.string().min(1).describe("Search query e.g. 'Finance Hub Sydney'"),
        page_size: z.number().int().min(1).max(10).default(10).describe("Max results to return"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, page_size }) => {
      const client = await createGBPClient();
      const body = cleanBody({
        query,
        pageSize: page_size,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.businessInformation}/googleLocations:search`,
        body
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "google locations search") }],
        structuredContent: data,
      };
    }
  );
}
