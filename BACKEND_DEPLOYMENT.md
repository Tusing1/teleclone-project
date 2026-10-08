# StudyGram backend deployment

## Status — 8 October 2026

### Full release preparation (supersedes the earlier isolated-correction status)

The user authorized pushing and publishing all accumulated changes. Local release fee70af includes the redesign, removed AI/games/token sections, media viewers/cache, message editing, channel threads, shared call engine, notifications and regression tests. Merge 88b55e8 retains remote Lovable history while using the reviewed release tree. Both deployed function sources match remote dd81306; useful timer typing and PostgREST version 14.5 are retained. Preview authentication brokerage is not included. No users, hosted files, profile pictures or databases are reset. Supabase temporary CLI files are ignored.

All 21 mocked tests and app-project TypeScript checks pass. GitHub push and live publishing must be separately verified; a code commit alone is not a live release. Nurses Revision will host the real test, with the user selecting Wardking as the receiving participant. Two actual devices are required; browser access to the host does not provide access to Wardking's device. Calls must not be sent before both participants have the updated frontend and are ready.

- Official Supabase CLI 2.120.0 is available through npx.
- Target project in supabase/config.toml: plhzfgfrlxywxaccewyh.
- Hosted read-only checks returned a valid P-256 VAPID public key and six ICE server entries including TURN. Neither check proves push delivery or successful cross-network audio.
- CLI login succeeded, but this account cannot access the configured project. It is absent from the accessible project list, and its functions endpoint returns HTTP 403 (insufficient privileges). Deployment uses Lovable Cloud's SQL editor instead; no backend relinking occurred.
- User confirmed Lovable Cloud ownership. Logged-in StudyGram project dbf08cab-e16f-4f05-bdd5-95fcc19c7c7b exposes Cloud SQL editor and Edge functions. Read-only SQL inspection succeeded; direct Supabase CLI deployment is not the current route.
- Before deployment, hosted prerequisite inspection found required message/channel/call columns and the SECURITY DEFINER membership helper; only update_messages_updated_at triggered on the inspected tables. Call read policies were global. Latest migration was 20260108192959. These findings were superseded by the approved migration deployment below.
- With explicit user approval, both 20261007120000 and 20261007200000 were applied together in an explicit transaction through Lovable SQL editor. The original four replaced policies are preserved in supabase/manual-deployment/20261008_original_call_policies.sql. Both migration records include the exact source in statements; no historical migrations were replayed.
- Live verification passed: four enabled guards, scoped call read policies, host participant UPDATE policy, both migration records, and both message indexes. Rollback-only synthetic actor probes rejected unauthorized post edits, comments without channel roots, unauthorized call control and nonmember participation; metadata-only updates remained allowed. No probe messages/calls were committed.
- An additional authenticated-role, synthetic-nonmember read probe confirmed call_participants and call_signals return no visible records; the role/claim settings were rolled back.
- Fifteen local tests pass, including simulated TURN and push edge-function tests. TypeScript no-emit validation and the production/PWA build pass, including the new Settings connection check. Build reported outdated Browserslist data; no chunk-size warning appeared in this build. Real-device audio/push remain pending. Secret values, user records, files and profile photos were not changed by our deployment actions.
- Deployment prerequisites checked in Lovable Cloud: METERED_API_KEY, METERED_API_KEY2, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY names are present. No values were revealed or changed; matching VAPID keypair/runtime delivery remains unverified.
- After explicit user approval, supabase/manual-deployment/LOVABLE_EDGE_DEPLOYMENT.md was submitted to StudyGram's Lovable Build chat. Lovable reports both functions deployed successfully. Remote origin/main commit dd81306 contains exact copies of both submitted function sources (normalized line endings); remote history was fetched only, not merged into the dirty local checkout. Function version identifiers were not exposed by Lovable's deployment tool.
- Independent live checks: get-vapid-key returns 200 with a valid P-256 public key; signed-out get-turn-credentials and send-push-notification both return 401. The signed-in localhost Settings → Check call connection request succeeded and validated a TURN entry with credentials. No microphone, call invitation or notification was opened/sent. This confirms authenticated relay configuration access, not cross-network audio or push delivery.
- IMPORTANT scope deviation: despite the no-frontend-change request, Lovable also changed timer types in eleven frontend files and generated preview authentication storage, Supabase types/client changes and TypeScript configuration edits. The remote deployment commit changes eighteen files overall. These unrequested remote frontend changes are not merged locally or published by us; review/restore requires separate direction. Do not blindly pull/revert the deployment commit, which also contains the approved functions.
- Public frontend compatibility: the existing published client still sends the old push request format; the new function intentionally rejects arbitrary-recipient requests. Publishing the reviewed local frontend (or a separately reviewed minimal client fix) is required for call notifications there. Nothing was published in this deployment.

## Current route: Lovable Cloud

### Correction pass — 8 October

- Isolated branch `codex/lovable-correction` in the managed `lovable-correction` worktree is based on remote deployment commit dd81306. It removes the unused preview authentication broker, restores localStorage authentication and both TypeScript baseUrl settings, and fixes the legacy push self-test contract/delivery check. Legitimate timer typing and generated schema changes are retained. Deployed edge function sources are unchanged. The active dirty redesign checkout was not merged or reset.
- The primary local frontend self-test now sends only user_id and requires a positive delivery count. Its call invitations already use call_id. The legacy remote call engine remains separate; do not treat this minimal correction as deployment of the redesigned call engine.
- Recording mixer cleanup is now idempotent and also runs when audio initialization fails. It stops only the recorder output, not caller microphones; updates after disposal cannot reconnect sources.
- Twenty-one local tests and app-project TypeScript validation pass, including four notification-client checks and two recording-mixer checks. These are mocked regression tests, not evidence of real-device audio, recording upload or push delivery.
- Nurses Revision is the selected host account. A second user-controlled account/device or consenting participant is still needed for genuine two-device acceptance testing. No invitations or recordings were sent in this correction pass.
- Corrections have not been published; obtain confirmation before updating the live frontend.
- Local isolated correction commit: 6be5b65 (not pushed). Its app-project TypeScript check, four notification-client regression tests and production build pass. That legacy frontend still reports a 1.68 MB entry chunk and the ambiguous duration-[2000ms] class; the primary redesigned frontend production build passes without either warning. Both builds report outdated Browserslist data. Publishing only the small correction does not deploy the local performance/UI redesign.

Open StudyGram in Lovable, then View Backend / More → Cloud → SQL editor. The two prepared migrations can be reviewed against this existing database without migrating users or changing the app's backend URL. Obtain action-time confirmation before applying live permission changes. Capture original policy definitions, use an explicit transaction, apply only the two reviewed migrations, and verify the resulting guards/policies and migration bookkeeping. Do not replay historical migrations or reset the database.

The Edge functions view exposes monitoring, not a manual deployment button. The approved deployment was performed through the project chat. Future uploads/prompts need appropriate confirmation, including possible Lovable credit use. Preserve existing Metered/VAPID secret values and do not silently publish the frontend.

## Direct Supabase route (only if ownership/access changes)

Run in your terminal:

    npx --yes supabase login

Complete sign-in yourself. Keep access tokens and database passwords out of chat.
Use the account that owns plhzfgfrlxywxaccewyh, or have its owner grant appropriate access. Do not point the app at an unrelated accessible project: existing accounts, channels and files belong to the current backend.
This is not a request for another login while Lovable Cloud manages the backend.

## Deployment gates

1. Verify project identity and intended backend. The CLI steps below apply only if direct project access becomes available; otherwise use the confirmed Lovable Cloud route above.
2. Read the hosted migration history and dry-run pending migrations. Expected new files are:
   - 20261007120000_channel_post_comments.sql
   - 20261007200000_channel_publish_and_call_controls.sql
3. If older migrations are unexpectedly pending, stop and reconcile hosted schema/history before proceeding. Do not reset the database, blindly include all migrations, prune functions, or overwrite secrets.
4. Check actual hosted columns, policies, helper functions and existing trigger names before applying the two migrations.
5. Apply only the reviewed pending migrations. Preserve existing messages and profile photos.
6. Deploy only send-push-notification and get-turn-credentials using server-side bundling (--use-api), not every function. The latter now verifies the caller's identity internally, rejects signed-out requests, limits provider waits, and reports unavailable relay service honestly.
7. Verify the deployed function versions and the new database controls. Confirm VAPID public/private key names and Metered secret names are present without exposing or rotating their values. A valid public key alone does not prove that its private counterpart matches.

Suggested read-only commands after login:

    npx --yes supabase projects list
    npx --yes supabase migration list --project-ref plhzfgfrlxywxaccewyh
    npx --yes supabase db push --project-ref plhzfgfrlxywxaccewyh --dry-run --skip-vault
    node scripts/check-backend.mjs

After deploying the authenticated TURN endpoint, an anonymous 401 is expected. Successful authenticated relay testing must happen from the signed-in app; do not extract browser session tokens into logs.

## Controlled two-device acceptance checks

- Use a channel host/admin and a regular channel member on separate devices/networks.
- Confirm members cannot publish, upload, replace, or forward work directly into the channel. Comments must reference a specific channel post; metadata/read updates must still work.
- Host starts audio, member joins muted, host grants speaking, both hear audio. Leave/rejoin; end for everyone; verify microphones and session UI close. Repeat with simultaneous joins and a network interruption.
- Start recording with participants' permission, stop/end, verify saved recording contains both voices and reaches Saved Messages. Call disconnection must not wait for upload completion.
- Enable notifications yourself. Verify foreground and background invitations, notification taps open the correct conversation, and ended calls do not keep ringing. Check Android and installed iOS PWA; browser push is not native CallKit/Android incoming-call integration.
- Download a PDF/image/audio, reopen via Downloaded after refresh, and verify on the actual phone with its network unavailable. Clearing app/site data can remove local copies.

No live invitations or call tests should be sent to existing members without selecting the test accounts and obtaining action-time confirmation.
