// src/services/token-manager.ts
//
// Manages Google OAuth 2.0 access tokens using a long-lived refresh token.
// Access tokens are cached in memory and refreshed automatically 5 minutes
// before expiry. No external state store required — works on Railway.
//
// Required env vars:
//   GBP_CLIENT_ID      — OAuth 2.0 client ID (from GCP Console)
//   GBP_CLIENT_SECRET  — OAuth 2.0 client secret
//   GBP_REFRESH_TOKEN  — Long-lived refresh token (obtained via setup flow below)
//
// Optional:
//   GBP_ACCESS_TOKEN   — Seed token (used on first request until refreshed)

import axios from "axios";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REFRESH_BUFFER_MS = 5 * 60 * 1_000; // Refresh 5 min before expiry

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cache: TokenCache | null = null;

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Run the OAuth setup to obtain your refresh token — see README.md#oauth-setup`
    );
  }
  return val;
}

export async function getValidAccessToken(): Promise<string> {
  // Return cached token if still valid with buffer
  if (cache && Date.now() < cache.expiresAt - REFRESH_BUFFER_MS) {
    return cache.accessToken;
  }

  // Try seeded static token first (useful for local dev / initial test)
  const staticToken = process.env.GBP_ACCESS_TOKEN;
  const hasRefreshCreds =
    process.env.GBP_CLIENT_ID &&
    process.env.GBP_CLIENT_SECRET &&
    process.env.GBP_REFRESH_TOKEN;

  if (!hasRefreshCreds) {
    // Fall back to static token — will expire after 1 hour
    if (staticToken) {
      console.error(
        "[token-manager] WARNING: No refresh credentials set. " +
          "Using GBP_ACCESS_TOKEN — will expire in ~1 hour. " +
          "Set GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN for auto-refresh."
      );
      return staticToken;
    }
    throw new Error(
      "No GBP credentials found. Set either:\n" +
        "  Option A (recommended): GBP_CLIENT_ID + GBP_CLIENT_SECRET + GBP_REFRESH_TOKEN\n" +
        "  Option B (dev only):    GBP_ACCESS_TOKEN (expires in ~1 hour)"
    );
  }

  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string> {
  const clientId = getRequiredEnv("GBP_CLIENT_ID");
  const clientSecret = getRequiredEnv("GBP_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("GBP_REFRESH_TOKEN");

  console.error("[token-manager] Refreshing access token...");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const { data } = await axios.post<{
    access_token: string;
    expires_in: number;
    token_type: string;
    error?: string;
    error_description?: string;
  }>(GOOGLE_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10_000,
  });

  if (data.error) {
    throw new Error(
      `Token refresh failed: ${data.error} — ${data.error_description ?? ""}.\n` +
        "Check GBP_CLIENT_ID, GBP_CLIENT_SECRET, and GBP_REFRESH_TOKEN are correct.\n" +
        "If refresh token has been revoked, re-run the OAuth setup flow."
    );
  }

  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };

  const expiresInMin = Math.round(data.expires_in / 60);
  console.error(
    `[token-manager] Access token refreshed. Expires in ${expiresInMin} min.`
  );

  return cache.accessToken;
}

// Pre-warm the cache on server start (non-fatal — logs warning if it fails)
export async function warmTokenCache(): Promise<void> {
  try {
    await getValidAccessToken();
    console.error("[token-manager] Token cache warmed ✓");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[token-manager] Token warm-up failed (non-fatal): ${msg}`);
  }
}
