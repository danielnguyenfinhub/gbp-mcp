#!/usr/bin/env node
// scripts/oauth-setup.mjs
//
// Run once to obtain a refresh token for your GBP OAuth credentials.
// After this, copy the refresh token into Railway env vars — it never expires
// unless you revoke it manually or it stays unused for 6+ months.
//
// Usage:
//   node scripts/oauth-setup.mjs
//
// Prerequisites:
//   1. Go to https://console.cloud.google.com/apis/credentials
//   2. Create an OAuth 2.0 Client ID → type: Desktop App
//   3. Copy the Client ID and Client Secret into this script or .env
//   4. Enable these APIs in GCP Console:
//      - My Business Account Management API
//      - My Business Business Information API
//      - Business Profile Performance API
//      - My Business Q&A API
//      - Google My Business API

import http from "http";
import { exec } from "child_process";
import { URL } from "url";
import https from "https";
import readline from "readline";

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.GBP_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GBP_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:8080/callback";
const PORT = 8080;

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
].join(" ");

// ── Prompt for missing values ─────────────────────────────────────────────────
async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let clientId = CLIENT_ID;
  let clientSecret = CLIENT_SECRET;

  if (!clientId) {
    clientId = await prompt("Enter your GBP_CLIENT_ID: ");
  }
  if (!clientSecret) {
    clientSecret = await prompt("Enter your GBP_CLIENT_SECRET: ");
  }

  if (!clientId || !clientSecret) {
    console.error("❌ Client ID and secret are required.");
    process.exit(1);
  }

  // Build the authorization URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // Forces refresh_token to be returned

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("GBP OAuth Setup — One-Time Authorisation");
  console.log("─────────────────────────────────────────────────────────");
  console.log("\n1. Opening browser for Google authorisation...");
  console.log(`\nIf the browser doesn't open, paste this URL manually:\n\n${authUrl.toString()}\n`);

  // Try to open browser
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${openCmd} "${authUrl.toString()}"`, (err) => {
    if (err) console.log("Could not auto-open browser. Use the URL above.");
  });

  // Start local server to capture the callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end(`<h1>❌ Authorisation denied: ${error}</h1><p>Close this tab.</p>`);
        server.close();
        reject(new Error(`Authorisation denied: ${error}`));
        return;
      }

      if (code) {
        res.end("<h1>✅ Authorised! Return to your terminal.</h1><p>You can close this tab.</p>");
        server.close();
        resolve(code);
      }
    });

    server.listen(PORT, () => {
      console.log(`\n2. Waiting for Google callback on http://localhost:${PORT}/callback ...`);
    });

    server.on("error", reject);

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorisation (2 min). Try again."));
    }, 120_000);
  });

  console.log("\n3. Exchanging authorisation code for tokens...");

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const tokens = await new Promise((resolve, reject) => {
    const postData = tokenBody.toString();
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Failed to parse token response: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });

  if (tokens.error) {
    console.error(`\n❌ Token exchange failed: ${tokens.error} — ${tokens.error_description}`);
    process.exit(1);
  }

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("✅  SUCCESS — Copy these into Railway environment variables");
  console.log("─────────────────────────────────────────────────────────\n");
  console.log(`GBP_CLIENT_ID=${clientId}`);
  console.log(`GBP_CLIENT_SECRET=${clientSecret}`);
  console.log(`GBP_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`\nAccess token (valid ~1 hour, auto-refreshed by server):`);
  console.log(`GBP_ACCESS_TOKEN=${tokens.access_token}`);
  console.log(`\n⚠️  The refresh token above does NOT expire unless revoked.`);
  console.log(`   Store it securely — treat it like a password.\n`);
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
