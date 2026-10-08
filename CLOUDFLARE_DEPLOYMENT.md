# StudyGram frontend migration

## Scope

Deploy this existing Vite app as the separate `studygram` Cloudflare Worker with Static Assets. Keep the same Supabase project, hosted functions, database, storage, TURN provider and push keys. Do not modify other Cloudflare applications or cancel Lovable Cloud while the backend is still there.

## Git build settings

- Repository: Tusing1/teleclone-project; production branch: main; root: repository root.
- Build command: `npm run build`.
- Deploy command: `npx wrangler@4 deploy`.
- Configuration: wrangler.jsonc, assets from dist, SPA navigation fallback enabled.
- Existing tracked .env contains only VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. These are browser-visible configuration, not service-role credentials. Do not add private backend secrets to frontend build variables.

## Cutover gates

1. Approve and deploy to the separate Cloudflare workers.dev URL first. No existing production domain is changed by this step.
2. Verify sign-in, nested-route reload, favicon, metadata, service worker and absence of Lovable-injected scripts/badge. Auth redirects may need the temporary origin added by the backend owner; never extract browser session tokens.
3. Verify backend requests and test authenticated messaging/calls with consenting users. New origins require signing in and registering push notifications separately; existing offline files do not move between origins.
4. Inspect studdybuddyapp.com DNS/provider ownership before changing routes. Preserve email records and unrelated services. Obtain action-time approval for domain/DNS changes and retain old records for rollback.
5. Cut over the same production domain only after verification. Existing installed PWAs may need an update/reopen; never clear site data as a migration shortcut.

Cloudflare deployment configuration and branding assets are now repository-controlled. The current build has no Lovable badge/script in its source; Lovable previously injected them during its own hosting. Existing downloaded files, users and avatars are not reset by this frontend migration.

Status: prepared, not yet deployed to Cloudflare or cut over.

Verified locally: production/PWA build and 28 regression tests pass. Cloudflare's existing GitHub installation currently exposes four unrelated repositories, not teleclone-project; the public-clone workflow would create another Git repository, so it was not used. Add only teleclone-project to the existing Cloudflare GitHub installation to retain automatic deployments from the authoritative repository.

Read-only DNS check on 8 October: studdybuddyapp.com uses ns1.dns-parking.com and ns2.dns-parking.com, not Cloudflare nameservers. Production-domain routing therefore needs separate DNS ownership/configuration work after the temporary deployment is verified. No DNS records or account plans were changed.
