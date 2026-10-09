# Link previews and in-app browsing

## Changes

- Known StudyGram application routes use React Router, not an iframe or a new tab. A shared homepage link leaves the current conversation and audio intact with a short confirmation toast. Unknown paths/downloads are not falsely treated as application routes.
- StudyGram preview cards immediately show the existing branded thumbnail and favicon. External cards request actual Open Graph/Twitter/title/description/icon metadata from the Cloudflare worker when near the viewport. YouTube image patterns remain a fallback.
- Metadata is cached at the edge for one day and in an account-scoped IndexedDB collection capped at 100 cards. Cached text is available offline; third-party images are not guaranteed offline. This does not replace the account-scoped downloaded-file cache.
- The API accepts signed-in users verified against the existing Supabase Auth service and rate-limits requests per user. Only public HTTPS links on the default port are accepted. Credential-bearing URLs, local names, IP literals, private/reserved DNS answers, unsafe redirects, oversized bodies and non-HTML pages are refused. No client authorization or cookies are forwarded to destination sites; URLs are submitted in a POST body and edge-cache keys are hashed.
- Destination/asset DNS records are checked before requests. Validation fails closed for ambiguous address ranges. This runs on Cloudflare's public fetch network, not inside a private network; do not move this fetch service to an intranet-capable host without DNS-pinned transport and a new SSRF review.
- External website previews remain best effort: bot restrictions, missing metadata, hotlink protection or unavailable pages can result in a compact fallback card.
- The web iframe viewer retains origin/mixed-content sandbox protections and clearly offers a browser fallback. It does not claim an iframe load event proves a website allowed embedding.
- The official Capacitor Browser plugin is wired into external link handling on native platforms. Android/iOS project creation, platform synchronization, signed builds and device testing are still required. PWA/Web Clip installs are not native packages.

## Deployment

Cloudflare retains the two existing custom domains and static SPA assets. Only `/api/*` runs the new Worker first. No database migration or Supabase Edge Function deployment is part of this release. The legacy `create-conversation` deployed revision remains unconfirmed; the released Saved flow uses the separately verified safe RPC.

## Verification

Run `node --test tests/*.test.mjs`, application and worker TypeScript checks, production/PWA build, and `npx wrangler deploy --dry-run` before publication. Verify the production bundle and preview API signed-out rejection after publication. Live authenticated preview verification requires a consenting signed-in user and an existing public link or an approved self-chat test message.
