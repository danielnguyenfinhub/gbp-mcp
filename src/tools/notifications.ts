// src/tools/notifications.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GBP_ENDPOINTS,
  createGBPClient,
  cleanBody,
} from "../services/gbp-client.js";

export function registerNotificationTools(server: McpServer): void {
  // ─── Get Notification Settings ────────────────────────────────────────────────
  server.registerTool(
    "gbp_get_notifications",
    {
      title: "Get GBP Notification Settings",
      description: `Get the notification settings for a Google Business Profile account.

Args:
  - name (string): Account resource name e.g. "accounts/123456789"

Returns:
  JSON with notification setting: name, notificationTypes[] (GOOGLE_UPDATE, NEW_REVIEW, UPDATED_REVIEW, etc.), pubsubTopic.

Examples:
  - "What notifications are enabled for my account?"
  - "Show notification settings for account 123"`,
      inputSchema: z.object({
        name: z.string().describe('Account resource name e.g. "accounts/123456789"'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const client = await createGBPClient();
      const accountName = name.startsWith("accounts/") ? name : `accounts/${name}`;
      const { data } = await client.get(
        `${GBP_ENDPOINTS.notifications}/${accountName}/notificationSetting`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );

  // ─── Update Notification Settings ─────────────────────────────────────────────
  server.registerTool(
    "gbp_update_notifications",
    {
      title: "Update GBP Notification Settings",
      description: `Update notification settings for a Google Business Profile account.

Args:
  - name (string): Account resource name e.g. "accounts/123456789"
  - notification_types (array): Array of notification types to enable:
      "GOOGLE_UPDATE" — Google edits to your listing
      "NEW_REVIEW" — New reviews
      "UPDATED_REVIEW" — Updated reviews
      "NEW_CUSTOMER_MESSAGE" — New customer messages
      "NEW_QUESTION" — New Q&A questions
      "DUPLICATE_LOCATION" — Duplicate location detected
      "VOICE_OF_MERCHANT" — Voice of merchant suggestions

Returns:
  Updated notification setting object.

Examples:
  - "Enable review notifications" -> notification_types=["NEW_REVIEW", "UPDATED_REVIEW"]
  - "Turn on all notifications"`,
      inputSchema: z.object({
        name: z.string().describe('Account resource name e.g. "accounts/123456789"'),
        notification_types: z.array(
          z.enum([
            "GOOGLE_UPDATE", "NEW_REVIEW", "UPDATED_REVIEW",
            "NEW_CUSTOMER_MESSAGE", "NEW_QUESTION",
            "DUPLICATE_LOCATION", "VOICE_OF_MERCHANT",
          ])
        ).min(1).describe("Notification types to enable"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, notification_types }) => {
      const client = await createGBPClient();
      const accountName = name.startsWith("accounts/") ? name : `accounts/${name}`;
      const body = cleanBody({
        name: `${accountName}/notificationSetting`,
        notificationTypes: notification_types,
      });
      const { data } = await client.patch(
        `${GBP_ENDPOINTS.notifications}/${accountName}/notificationSetting?updateMask=notificationTypes`,
        body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    }
  );
}
