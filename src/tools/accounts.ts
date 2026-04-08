// src/tools/accounts.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerAccountTools(server: McpServer): void {
  // ─── List Accounts ───────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_accounts",
    {
      title: "List GBP Accounts",
      description: `List all Google Business Profile accounts accessible to the authenticated user.

Returns a list of accounts including account ID, name, type (PERSONAL, LOCATION_GROUP, USER_GROUP, ORGANIZATION), and verification state.

Args:
  - page_size (number): Max results per page, 1–20 (default: 20)
  - page_token (string): Pagination token from previous response

Returns:
  JSON with accounts[] array and nextPageToken (if more results exist).
  Each account includes: name (resource path), accountName, type, verificationState, vettedState.

Examples:
  - Use when: "Show me all my GBP accounts"
  - Use when: "What Google Business accounts do I have?"`,
      inputSchema: z.object({
        page_size: z.number().int().min(1).max(20).default(20).describe("Max accounts to return per page"),
        page_token: z.string().optional().describe("Pagination token from previous response"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_size, page_token }) => {
      const client = await createGBPClient();
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.accountManagement}/accounts?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "accounts list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Account ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_account",
    {
      title: "Get GBP Account",
      description: `Get details for a specific Google Business Profile account.

Args:
  - account_id (string): Account resource name e.g. "accounts/123456789"

Returns:
  JSON with accountName, type, verificationState, vettedState, permissionLevel.`,
      inputSchema: z.object({
        account_id: z.string().describe('Account resource name e.g. "accounts/123456789"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ account_id }) => {
      const client = await createGBPClient();
      const name = account_id.startsWith("accounts/") ? account_id : `accounts/${account_id}`;
      const { data } = await client.get(`${GBP_ENDPOINTS.accountManagement}/${name}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── List Locations ───────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_locations",
    {
      title: "List GBP Locations",
      description: `List all business locations under a Google Business Profile account.

Args:
  - account_id (string): Account resource name e.g. "accounts/123456789"
  - page_size (number): Max results per page, 1–100 (default: 100)
  - page_token (string): Pagination token from previous response
  - read_mask (string): Comma-separated fields to return e.g. "name,title,phoneNumbers,websiteUri" (default: all basic fields)
  - filter (string): Filter string e.g. "title=Finance Hub"

Returns:
  JSON with locations[] array and nextPageToken.
  Each location includes: name (resource path), title, storefrontAddress, phoneNumbers, websiteUri, categories, regularHours, openInfo.

Examples:
  - Use when: "List all my locations" -> account_id="accounts/123"
  - Use when: "Show Finance Hub Sydney location details"`,
      inputSchema: z.object({
        account_id: z.string().describe('Account resource name e.g. "accounts/123456789"'),
        page_size: z.number().int().min(1).max(100).default(100).describe("Max locations per page"),
        page_token: z.string().optional().describe("Pagination token"),
        read_mask: z.string().optional().describe('Comma-separated fields e.g. "name,title,phoneNumbers,websiteUri"'),
        filter: z.string().optional().describe('Filter string e.g. "title=Finance Hub"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ account_id, page_size, page_token, read_mask, filter }) => {
      const client = await createGBPClient();
      const name = account_id.startsWith("accounts/") ? account_id : `accounts/${account_id}`;
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      if (read_mask) params.set("readMask", read_mask);
      if (filter) params.set("filter", filter);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.businessInformation}/${name}/locations?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "locations list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Location ─────────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_location",
    {
      title: "Get GBP Location",
      description: `Get full details for a specific business location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - read_mask (string): Comma-separated fields e.g. "name,title,phoneNumbers,websiteUri,storefrontAddress,regularHours,categories" (default: all)

Returns:
  Full location object including: title, storefrontAddress, phoneNumbers, websiteUri, categories, regularHours, specialHours, openInfo, serviceArea, metadata.

Examples:
  - "Get details for location 1234567890"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890123456789"'),
        read_mask: z.string().optional().describe('Comma-separated fields to return'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, read_mask }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams();
      if (read_mask) params.set("readMask", read_mask);
      const url = params.size
        ? `${GBP_ENDPOINTS.businessInformation}/${name}?${params}`
        : `${GBP_ENDPOINTS.businessInformation}/${name}`;
      const { data } = await client.get(url);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Update Location ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_update_location",
    {
      title: "Update GBP Location",
      description: `Update business information for a Google Business Profile location.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - update_mask (string): REQUIRED — comma-separated list of fields being updated e.g. "title,phoneNumbers.primaryPhone,websiteUri"
  - title (string): Business name/title
  - primary_phone (string): Primary phone in international format e.g. "+61430111188"
  - additional_phones (array): Additional phone numbers
  - website_uri (string): Website URL e.g. "https://finhub.net.au"
  - description (string): Business description (up to 750 chars)
  - regular_hours (object): Opening hours — see GBP API format
  - primary_category_id (string): Primary category resource name e.g. "gcid:mortgage_broker"

Returns:
  Updated location object.

Note: Only fields listed in update_mask are changed. All others preserved.

Examples:
  - "Update phone number for location 123" -> update_mask="phoneNumbers"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        update_mask: z.string().describe('Comma-separated fields to update e.g. "title,websiteUri,phoneNumbers"'),
        title: z.string().optional().describe("Business display name"),
        primary_phone: z.string().optional().describe('Primary phone in international format e.g. "+61430111188"'),
        additional_phones: z.array(z.string()).optional().describe("Additional phone numbers"),
        website_uri: z.string().optional().describe("Website URL"),
        description: z.string().max(750).optional().describe("Business description (max 750 chars)"),
        primary_category_id: z.string().optional().describe('Primary category gcid e.g. "gcid:mortgage_broker"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, update_mask, title, primary_phone, additional_phones, website_uri, description, primary_category_id }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;

      const body: Record<string, unknown> = cleanBody({
        title,
        websiteUri: website_uri,
        profile: description ? { description } : undefined,
        phoneNumbers: (primary_phone || additional_phones)
          ? {
              primaryPhone: primary_phone,
              additionalPhones: additional_phones,
            }
          : undefined,
        categories: primary_category_id
          ? { primaryCategory: { name: primary_category_id } }
          : undefined,
      });

      const { data } = await client.patch(
        `${GBP_ENDPOINTS.businessInformation}/${name}?updateMask=${update_mask}`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Get Google-Updated Location ──────────────────────────────────────────────
  server.registerTool(
    "gbp_get_google_updated_location",
    {
      title: "Get Google-Updated Location",
      description: `Get the Google-updated version of a location to see changes Google has suggested or applied.

Useful for detecting when Google has overridden your business information.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"
  - read_mask (string): Fields to return

Returns:
  Object with location (Google-updated version) and diffMask (fields that differ from owner's data).`,
      inputSchema: z.object({
        location_name: z.string().describe("Location resource name"),
        read_mask: z.string().optional().describe("Comma-separated fields to return"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name, read_mask }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      const params = new URLSearchParams();
      if (read_mask) params.set("readMask", read_mask);
      const url = `${GBP_ENDPOINTS.businessInformation}/${name}:getGoogleUpdated${params.size ? `?${params}` : ""}`;
      const { data } = await client.get(url);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Create Location ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_create_location",
    {
      title: "Create GBP Location",
      description: `Create a new business location under a Google Business Profile account.

Args:
  - parent (string): Account resource name e.g. "accounts/123456789"
  - title (string): Business display name
  - storefront_address (object): Business address with fields: regionCode, languageCode, postalCode, administrativeArea, locality, addressLines[]
  - primary_phone (string): Primary phone in international format e.g. "+61430111188"
  - additional_phones (array): Additional phone numbers
  - website_uri (string): Website URL
  - primary_category_id (string): Primary category gcid e.g. "gcid:mortgage_broker"
  - description (string): Business description (max 750 chars)
  - regular_hours (object): Opening hours in GBP API format with periods[] array

Returns:
  Created location object with name, title, storefrontAddress, metadata.

Examples:
  - "Create a new location for Finance Hub Sydney"
  - "Add a new branch at 123 Main St"`,
      inputSchema: z.object({
        parent: z.string().describe('Account resource name e.g. "accounts/123456789"'),
        title: z.string().describe("Business display name"),
        storefront_address: z.object({
          regionCode: z.string().optional().describe("Region code e.g. AU"),
          languageCode: z.string().optional().describe("Language code e.g. en"),
          postalCode: z.string().optional().describe("Postal code"),
          administrativeArea: z.string().optional().describe("State/province"),
          locality: z.string().optional().describe("City"),
          addressLines: z.array(z.string()).optional().describe("Street address lines"),
        }).optional().describe("Business street address"),
        primary_phone: z.string().optional().describe('Primary phone e.g. "+61430111188"'),
        additional_phones: z.array(z.string()).optional().describe("Additional phone numbers"),
        website_uri: z.string().optional().describe("Website URL"),
        primary_category_id: z.string().optional().describe('Primary category gcid e.g. "gcid:mortgage_broker"'),
        description: z.string().max(750).optional().describe("Business description (max 750 chars)"),
        regular_hours: z.object({
          periods: z.array(z.object({
            openDay: z.string().describe("Day of week e.g. MONDAY"),
            openTime: z.object({ hours: z.number(), minutes: z.number().optional() }).describe("Opening time"),
            closeDay: z.string().describe("Closing day of week"),
            closeTime: z.object({ hours: z.number(), minutes: z.number().optional() }).describe("Closing time"),
          })).describe("Array of opening periods"),
        }).optional().describe("Regular opening hours"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ parent, title, storefront_address, primary_phone, additional_phones, website_uri, primary_category_id, description, regular_hours }) => {
      const client = await createGBPClient();
      const accountName = parent.startsWith("accounts/") ? parent : `accounts/${parent}`;
      const body = cleanBody({
        title,
        storefrontAddress: storefront_address,
        phoneNumbers: (primary_phone || additional_phones)
          ? cleanBody({
              primaryPhone: primary_phone,
              additionalPhones: additional_phones,
            })
          : undefined,
        websiteUri: website_uri,
        categories: primary_category_id
          ? { primaryCategory: { name: primary_category_id } }
          : undefined,
        profile: description ? { description } : undefined,
        regularHours: regular_hours,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.businessInformation}/${accountName}/locations`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Delete Location ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_delete_location",
    {
      title: "Delete GBP Location",
      description: `Delete a business location from Google Business Profile.

WARNING: This permanently removes the location. This action cannot be undone.

Args:
  - location_name (string): Location resource name e.g. "locations/1234567890123456789"

Returns:
  Empty response on success.

Examples:
  - "Delete location 1234567890"`,
      inputSchema: z.object({
        location_name: z.string().describe('Location resource name e.g. "locations/1234567890"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ location_name }) => {
      const client = await createGBPClient();
      const name = location_name.startsWith("locations/") ? location_name : `locations/${location_name}`;
      await client.delete(`${GBP_ENDPOINTS.businessInformation}/${name}`);
      return {
        content: [{ type: "text", text: "Location deleted successfully." }],
      };
    }
  );
}
