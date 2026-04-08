// src/tools/verifications.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  truncateIfNeeded,
  cleanBody,
} from "../services/gbp-client.js";

export function registerVerificationTools(server: McpServer): void {
  // ─── List Verifications ───────────────────────────────────────────────────────
  server.registerTool(
    "gbp_list_verifications",
    {
      title: "List GBP Verifications",
      description: `List all verifications for a location.

Args:
  - parent (string): Location resource name e.g. "locations/1234567890123456789"
  - page_size (number): Max results per page, 1–100 (default: 20)
  - page_token (string): Pagination token from previous response

Returns:
  JSON with verifications[] and nextPageToken.
  Each verification: name, method (ADDRESS/EMAIL/PHONE_CALL/SMS/AUTO), state (PENDING/COMPLETED/FAILED), createTime.

Examples:
  - "What verifications exist for my location?"
  - "Check verification status for location 123"`,
      inputSchema: z.object({
        parent: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        page_size: z.number().int().min(1).max(100).default(20).describe("Max results per page"),
        page_token: z.string().optional().describe("Pagination token from previous response"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ parent, page_size, page_token }) => {
      const client = await createGBPClient();
      const name = parent.startsWith("locations/") ? parent : `locations/${parent}`;
      const params = new URLSearchParams({ pageSize: String(page_size) });
      if (page_token) params.set("pageToken", page_token);
      const { data } = await client.get(
        `${GBP_ENDPOINTS.verifications}/${name}/verifications?${params}`
      );
      return {
        content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(data, null, 2), "verifications list") }],
        structuredContent: data,
      };
    }
  );

  // ─── Fetch Verification Options ───────────────────────────────────────────────
  server.registerTool(
    "gbp_fetch_verification_options",
    {
      title: "Fetch Verification Options",
      description: `Fetch the available verification methods for a location.

Args:
  - location (string): Location resource name e.g. "locations/1234567890123456789"
  - language_code (string): Language code e.g. "en" (default)
  - context_address (object): Optional address context for verification with fields: regionCode, languageCode, postalCode, administrativeArea, locality, addressLines[]

Returns:
  JSON with options[] — each with verificationMethod (ADDRESS/EMAIL/PHONE_CALL/SMS/AUTO/VETTED_PARTNER) and available details (phoneNumber, emailAddress, addressData).

Examples:
  - "What verification methods are available for my location?"
  - "Can I verify location 123 by phone?"`,
      inputSchema: z.object({
        location: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        language_code: z.string().default("en").describe("Language code e.g. en"),
        context_address: z.object({
          regionCode: z.string().optional().describe("Region code e.g. AU"),
          languageCode: z.string().optional().describe("Language code"),
          postalCode: z.string().optional().describe("Postal code"),
          administrativeArea: z.string().optional().describe("State/province"),
          locality: z.string().optional().describe("City"),
          addressLines: z.array(z.string()).optional().describe("Street address lines"),
        }).optional().describe("Optional address context for verification"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ location, language_code, context_address }) => {
      const client = await createGBPClient();
      const name = location.startsWith("locations/") ? location : `locations/${location}`;
      const body = cleanBody({
        languageCode: language_code,
        context: context_address ? { address: context_address } : undefined,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.verifications}/${name}:fetchVerificationOptions`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Verify Location ──────────────────────────────────────────────────────────
  server.registerTool(
    "gbp_verify_location",
    {
      title: "Verify GBP Location",
      description: `Initiate verification for a location using the specified method.

Args:
  - location (string): Location resource name e.g. "locations/1234567890123456789"
  - method (string): Verification method — "ADDRESS", "EMAIL", "PHONE_CALL", "SMS", "AUTO", "VETTED_PARTNER"
  - email_address (string): [EMAIL only] Email to send verification to
  - mailer_contact_name (string): [ADDRESS only] Name of person at the mailing address
  - phone_number (string): [PHONE_CALL/SMS only] Phone number in international format

Returns:
  Verification object with name, method, state, createTime.

Examples:
  - "Verify my location by postcard" -> method="ADDRESS"
  - "Verify by SMS" -> method="SMS", phone_number="+61430111188"`,
      inputSchema: z.object({
        location: z.string().describe('Location resource name e.g. "locations/1234567890"'),
        method: z.enum(["ADDRESS", "EMAIL", "PHONE_CALL", "SMS", "AUTO", "VETTED_PARTNER"])
          .describe("Verification method"),
        email_address: z.string().email().optional().describe("[EMAIL] Email to send verification to"),
        mailer_contact_name: z.string().optional().describe("[ADDRESS] Name of person at the mailing address"),
        phone_number: z.string().optional().describe("[PHONE_CALL/SMS] Phone number in international format"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ location, method, email_address, mailer_contact_name, phone_number }) => {
      const client = await createGBPClient();
      const name = location.startsWith("locations/") ? location : `locations/${location}`;
      const body = cleanBody({
        method,
        emailInput: email_address ? { emailAddress: email_address } : undefined,
        addressInput: mailer_contact_name ? { mailerContactName: mailer_contact_name } : undefined,
        phoneInput: phone_number ? { phoneNumber: phone_number } : undefined,
      });
      const { data } = await client.post(
        `${GBP_ENDPOINTS.verifications}/${name}:verify`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );
}
