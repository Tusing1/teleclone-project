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

Status: frontend deployed to Cloudflare on 8 October. Both studdybuddyapp.com and www.studdybuddyapp.com are attached to the production studygram Worker and verified publicly over HTTPS.

Deployment approved by the user, using the existing Workers Builds token without creating credentials or upgrading plans. The first build failed on obsolete binary bun.lockb; commit 93dc2d9 removed only that lockfile (recoverable from Git), retaining the matching package-lock.json. The automatic retry e47ffd27-64e2-4752-9f29-e989480dd9ae succeeded; Worker version 3d4c0d76-463a-4eb8-98d3-8c0594c38374 uploaded 49 assets. Preview branch builds were disabled in setup; version preview URLs are enabled by Wrangler defaults, distinct from branch builds.

Independent browser and HTTP checks: /auth returns StudyGram and loads without captured startup errors, Lovable badge or flock script; favicon and both app icons return PNG; manifest, service worker and push handler return 200 with no-cache. Signed-in messaging/calling on this origin remains untested and requires the user to sign in themselves. The public preview image still points to the retained production domain until DNS cutover.

Verified locally: production/PWA build and 28 regression tests pass. With action-time approval, teleclone-project was added to Cloudflare's existing GitHub installation, preserving its four other selected repositories. The authoritative repository drives automatic main-branch deployments; no duplicate repository was created.

Initial read-only DNS check on 8 October found ns1.dns-parking.com and ns2.dns-parking.com. The approved migration below replaces this delegation; no paid account plan was introduced.

Hostinger UI confirms three records only: apex A 185.158.133.1 (TTL 14400), www CNAME studdybuddyapp.com (TTL 300), and _lovable verification TXT (TTL 14400). No mail records were listed. A pre-cutover snapshot is retained outside the repo in ../studygram-dns-before-cloudflare.txt. Registration stays with Hostinger.

With explicit user approval, studdybuddyapp.com was added on Cloudflare's Free plan. The scanner imported A and CNAME; the original _lovable TXT was restored from the backup. All three values are present, using automatic TTLs; web records remain DNS-only to preserve existing direct hosting until Worker attachment. Cloudflare zone ID: 04cc07f5e4f1beca82a49d58adca8e1c.

After separate action-time approval, Hostinger accepted guss.ns.cloudflare.com and tina.ns.cloudflare.com on 8 October and displayed "Nameservers changed!". Cloudflare's initial check reported waiting for registrar propagation. No DNSSEC DS record was found in the read-only public check; no security setting was changed.

The user then approved the final root and www website routing replacement. Cloudflare required removal of the old apex A and www CNAME before attachment; only those two backed-up records were deleted. Both domains now appear as Production on the studygram Worker. The _lovable TXT is preserved. No www redirect was introduced: both origins serve the frontend. wrangler.jsonc retains these exact custom-domain routes so future Git deployments do not remove the dashboard attachments. Backend hosting, users, messages, files and keys remain unchanged.

Public cutover verification: Google DNS returns guss.ns.cloudflare.com and tina.ns.cloudflare.com. Both HTTPS /auth endpoints return 200, Server: cloudflare, the StudyGram title and no Lovable badge/flock injection. The root domain opens the StudyGram sign-in screen in the browser. Signed-in messaging, real calls, recording and push delivery remain separate user-assisted tests; these checks do not claim they passed. Some clients can retain old DNS caches temporarily. Do not cancel the Lovable-managed backend.
