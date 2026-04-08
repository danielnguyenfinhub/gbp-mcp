# gbp-mcp-server

MCP server for Google Business Profile APIs. Covers accounts, locations, reviews, posts, performance metrics, Q&A, and attributes.

---

## Tools (18 total)

| Tool | Description |
|---|---|
| `gbp_list_accounts` | List all GBP accounts accessible to the token |
| `gbp_get_account` | Get a specific account |
| `gbp_list_locations` | List locations under an account |
| `gbp_get_location` | Get full location details |
| `gbp_update_location` | Update business info (phone, hours, website, etc.) |
| `gbp_get_google_updated_location` | See Google-suggested changes vs. your data |
| `gbp_list_reviews` | List customer reviews (with pagination + sort) |
| `gbp_get_review` | Get a specific review |
| `gbp_reply_to_review` | Post or update owner reply to a review |
| `gbp_delete_review_reply` | Delete an owner reply |
| `gbp_list_posts` | List posts (What's New, Events, Offers) |
| `gbp_create_post` | Create a new post |
| `gbp_delete_post` | Delete a post |
| `gbp_get_daily_metrics` | Fetch daily impressions, clicks, direction requests |
| `gbp_get_search_keywords` | Top search terms driving impressions (monthly) |
| `gbp_list_questions` | List Q&A questions |
| `gbp_answer_question` | Post or update owner answer to a Q&A question |
| `gbp_list_attributes` | List available attributes for a category/region |
| `gbp_get_location_attributes` | Get attributes set on a location |
| `gbp_update_location_attributes` | Update location attributes |
| `gbp_list_categories` | Search for valid GBP business categories |

---

## Authentication

The GBP API uses OAuth 2.0. Access tokens expire after 1 hour — you need to refresh them via your OAuth flow.

**Required OAuth Scope:**
```
https://www.googleapis.com/auth/business.manage
```

**APIs to enable in GCP Console:**
- My Business Account Management API
- My Business Business Information API
- Business Profile Performance API
- My Business Q&A API
- My Business Place Actions API
- My Business Notifications API
- My Business Verifications API
- Google My Business API (v4.9 — for Reviews and Posts)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GBP_ACCESS_TOKEN` | Yes | OAuth 2.0 access token |
| `PORT` | No | HTTP port (default: 3000) |
| `TRANSPORT` | No | `http` or `stdio` (default: stdio) |

---

## Railway Deployment

1. Push this repo to GitHub
2. Create a new Railway project → Deploy from GitHub
3. Set environment variables in Railway dashboard:
   - `GBP_ACCESS_TOKEN` = your OAuth token (rotate before expiry)
   - `TRANSPORT` = `http`
   - `PORT` = `3000` (Railway sets this automatically)
4. Railway start command: `node dist/index.js`
5. MCP endpoint: `https://your-app.up.railway.app/mcp`

**Note on token rotation:** GBP access tokens expire after 1 hour. For production, implement a refresh token flow and update `GBP_ACCESS_TOKEN` in Railway env vars via CI/CD, or proxy through a token-refreshing middleware layer.

---

## Local Development

```bash
# Install
npm install

# Build
npm run build

# Run (stdio mode — for MCP Inspector)
node dist/index.js

# Run (HTTP mode)
TRANSPORT=http GBP_ACCESS_TOKEN=ya29.xxx node dist/index.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

---

## Key Resource ID Formats

| Resource | Format |
|---|---|
| Account | `accounts/123456789` |
| Location | `locations/1234567890123456789` |
| Review | `locations/1234567890/reviews/AbCdEf` |
| Post | `locations/1234567890/localPosts/abcdef` |
| Question | `locations/1234567890/questions/question123` |

Use `gbp_list_accounts` → `gbp_list_locations` to discover your IDs.

---

## Federated API Endpoints

GBP uses separate base URLs per feature — this server handles the routing internally:

| Feature | Base URL |
|---|---|
| Account Management | `https://mybusinessaccountmanagement.googleapis.com/v1` |
| Business Information | `https://mybusinessbusinessinformation.googleapis.com/v1` |
| Performance | `https://businessprofileperformance.googleapis.com/v1` |
| Reviews + Posts | `https://mybusiness.googleapis.com/v4` |
| Q&A | `https://mybusinessqanda.googleapis.com/v1` |
