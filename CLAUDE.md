# Google Business Profile MCP — CLAUDE.md

## 1. Project Overview
TypeScript MCP server exposing Google Business Profile API tools for Finance Hub GBP listings.
Deployed on Railway at gbp-mcp-production.up.railway.app/mcp.
Manages posts, reviews, Q&A, photos, and insights across Sydney, Melbourne, and Adelaide listings.

## 2. Tech Stack
- Runtime: Node.js 18+
- Language: TypeScript
- Framework: MCP SDK (@modelcontextprotocol/sdk)
- Transport: Streamable HTTP
- Auth: Google OAuth 2.0 (GBP-scoped)
- Host: Railway (auto-deploy from main branch)
- Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GBP_ACCOUNT_ID, PORT

## 3. Conventions
- NAP consistency critical: Name = "Finance Hub and Networks" | Address = 10 Ador Ave Rockdale NSW 2216 | Phone = 0430 11 11 88
- All GBP posts: ASIC RG 234 compliant — run compliance check before publishing
- Review replies: respond within 48 hours — warm, professional tone
- Posts: max 1,500 characters | include CTA | no banned phrases
- Photos: minimum 720x720px | business-relevant | no stock images
- Three locations: Sydney (primary) | Melbourne | Adelaide — confirm which before any write
- Insights: fetch monthly for reporting

## 4. Files — Never Touch
- .env / .env.production
- railway.toml
- Any file containing GOOGLE_CLIENT_SECRET or GOOGLE_REFRESH_TOKEN
- OAuth token cache files
