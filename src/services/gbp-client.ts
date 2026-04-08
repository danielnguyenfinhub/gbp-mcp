// src/services/gbp-client.ts
import axios, { type AxiosInstance, type AxiosError } from "axios";
import { getValidAccessToken } from "./token-manager.js";

// Base URLs for each federated GBP API endpoint
export const GBP_ENDPOINTS = {
  accountManagement: "https://mybusinessaccountmanagement.googleapis.com/v1",
  businessInformation: "https://mybusinessbusinessinformation.googleapis.com/v1",
  performance: "https://businessprofileperformance.googleapis.com/v1",
  mybusiness: "https://mybusiness.googleapis.com/v4",  // Reviews, Posts (v4.9 functionality)
  qanda: "https://mybusinessqanda.googleapis.com/v1",
  placeActions: "https://mybusinessplaceactions.googleapis.com/v1",
  notifications: "https://mybusinessnotifications.googleapis.com/v1",
  verifications: "https://mybusinessverifications.googleapis.com/v1",
} as const;

export async function createGBPClient(): Promise<AxiosInstance> {
  const accessToken = await getValidAccessToken();
  const client = axios.create({
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-GOOG-API-FORMAT-VERSION": "2",
    },
    timeout: 30_000,
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const status = error.response?.status;
      const data = error.response?.data as Record<string, unknown> | undefined;
      const message =
        (data?.error as Record<string, unknown>)?.message ??
        error.message ??
        "Unknown error";

      if (status === 401) {
        throw new Error(
          `Authentication failed (401): ${message}. Ensure your access token is valid and not expired.`
        );
      } else if (status === 403) {
        throw new Error(
          `Permission denied (403): ${message}. Ensure the required GBP API is enabled in GCP Console and the token has the correct OAuth scopes.`
        );
      } else if (status === 404) {
        throw new Error(
          `Resource not found (404): ${message}. Verify the account ID or location ID is correct.`
        );
      } else if (status === 429) {
        throw new Error(
          `Rate limit exceeded (429): ${message}. Reduce request frequency or request a quota increase.`
        );
      } else if (status === 409) {
        throw new Error(
          `Conflict (409): ${message}. The resource may already exist or there is a duplicate request.`
        );
      }
      throw new Error(`GBP API Error (${status ?? "unknown"}): ${message}`);
    }
  );

  return client;
}

export { getValidAccessToken };

export function formatPageToken(token: string | undefined): string {
  return token ? `&pageToken=${token}` : "";
}

// Strip undefined keys before serialising to JSON body
export function cleanBody(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  );
}

export const CHARACTER_LIMIT = 50_000;

export function truncateIfNeeded(text: string, label = "response"): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    `\n\n[${label} truncated at ${CHARACTER_LIMIT} chars — use pagination or narrower filters]`
  );
}
